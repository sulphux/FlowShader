import type { ShaderNodeDefinition } from './types';
import type { CustomNodeDefinition } from './customNodeManager';
import { generateCustomNodeFunction, autoCast } from './functionGenerator';
import { shaderDebug } from './shaderDebug';
import { createCompilerDebugReport } from './compilerDebugReport';
import type { CompilerDebugReport } from './compilerDebugReport';
import { collectRuntimeResources, buildUniformDeclarations } from './runtimeResources';

export interface GraphNode {
  id: string;
  type: string;
  data: {
    definition: ShaderNodeDefinition;
    isParameter?: boolean;  // For Custom Input nodes used as function parameters
    externalInput?: string;  // External input value for Custom Input nodes
    detectedType?: string;   // Detected type for Custom Input/Output nodes
    value?: unknown;         // Node value (for controls)
  };
}

export interface GraphEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface CompiledShaderResult {
  shader: string;
  debugReport: CompilerDebugReport;
}

const sortNodesTopologically = (nodes: GraphNode[], edges: GraphEdge[], targetNodeId?: string): GraphNode[] => {
  const visited = new Set<string>();
  const sorted: GraphNode[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const inputEdges = edges.filter(e => e.target === nodeId);
    inputEdges.forEach(edge => visit(edge.source));
    const node = nodeMap.get(nodeId);
    if (node) sorted.push(node);
  };

  if (targetNodeId) visit(targetNodeId);
  else nodes.forEach(node => visit(node.id));

  return sorted;
};

/**
 * Compile subgraph body (no uniforms/precision/main wrapper)
 * Used for generating custom node function bodies
 */
function compileSubgraphMainBody(nodes: GraphNode[], edges: GraphEdge[], targetNodeId: string): string {
  const safeEdges = edges as GraphEdge[];
  const sortedNodes = sortNodesTopologically(nodes, safeEdges, targetNodeId);

  let body = '';
  const nodeVarMap: Record<string, string> = {};

  sortedNodes.forEach(node => {
    const def = node.data?.definition;
    if (!def) return;

    // Skip Custom Input nodes - they are function parameters
    if (def.id === 'custom_input') {
      // Sanitize node ID for use as GLSL identifier (hyphens are not allowed)
      const glslParamName = node.id.replace(/-/g, '_');
      nodeVarMap[node.id] = glslParamName;
      shaderDebug.log('compiler', 'Mapped custom input to function parameter', { nodeId: node.id, paramName: glslParamName });
      return;
    }

    // Map inputs
    const inputs: Record<string, string> = {};
    def.inputs.forEach(inputDef => {
      const edge = safeEdges.find(e => e.target === node.id && e.targetHandle === inputDef.id);
      if (edge && nodeVarMap[edge.source]) {
        const sourceVarName = nodeVarMap[edge.source];
        const sourceNode = nodes.find(n => n.id === edge.source);

        // Determine source type
        let sourceRawType = 'float';

        if (sourceNode?.data.definition.varType) {
          sourceRawType = sourceNode.data.definition.varType;
        } else if (sourceNode?.data.definition.id.includes('split') && sourceNode.data.definition.inputs.length > 0) {
          sourceRawType = sourceNode.data.definition.inputs[0].type;
        } else if (sourceNode?.data.definition.id === 'custom_input') {
          // For Custom Input, use detectedType
          sourceRawType = sourceNode.data.detectedType || sourceNode.data.definition.outputs[0]?.type || 'float';
        } else {
          // Fallback do pierwszego wyjścia, gdy sourceHandle nie pasuje (np. stare zapisy z 'result')
          const outputs = sourceNode?.data.definition.outputs || [];
          sourceRawType = outputs.find(o => o.id === edge.sourceHandle)?.type || outputs[0]?.type || 'float';
        }

        // Handle swizzling
        const isSwizzled = edge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(edge.sourceHandle);
        const effectiveSourceType = isSwizzled ? 'float' : sourceRawType;
        const sourceExpression = isSwizzled ? `${sourceVarName}.${edge.sourceHandle}` : sourceVarName;

        // Auto-cast to target type
        const targetType = inputDef.type;
        const finalExpr = autoCast(sourceExpression, effectiveSourceType, targetType);

        inputs[inputDef.id] = finalExpr;
      }
    });

    // Generate GLSL code (nodeId w data — szablony uniformów, np. tekstury)
    const glslCode = def.glslTemplate(inputs, { ...node.data, nodeId: node.id });

    // Determine variable type
    let nodeType = 'vec3';

    if (def.varType) {
      nodeType = def.varType;
    } else if (def.id.includes('split')) {
      if (node.data.definition.inputs.length > 0) {
        const inputType = node.data.definition.inputs[0].type;
        nodeType = inputType === 'auto' ? 'vec3' : inputType;
      }
    } else if (def.id === 'custom_output') {
      // Custom Output: prioritize detectedType, then check incoming connection type
      if (node.data.detectedType && node.data.detectedType !== 'auto') {
        nodeType = node.data.detectedType;
      } else {
        // Check incoming edge to determine type
        const incomingEdge = safeEdges.find(e => e.target === node.id);
        if (incomingEdge) {
          const sourceNode = nodes.find(n => n.id === incomingEdge.source);
          if (sourceNode) {
            if (sourceNode.data.definition.id === 'custom_input') {
              nodeType = sourceNode.data.detectedType || 'vec3';
            } else {
              const sourceOutput = sourceNode.data.definition.outputs.find(o => o.id === incomingEdge.sourceHandle);
              nodeType = sourceOutput?.type === 'auto' ? 'vec3' : (sourceOutput?.type || 'vec3');
            }
          }
        } else if (node.data.definition.inputs.length > 0) {
          const inputType = node.data.definition.inputs[0].type;
          nodeType = inputType === 'auto' ? 'vec3' : inputType;
        }
      }
    } else {
      // Standard: type = first output type
      if (node.data.definition.outputs.length > 0) {
        const outputType = node.data.definition.outputs[0].type;
        nodeType = outputType === 'auto' ? 'vec3' : outputType;
      }
    }

    // Skip nodes with auto type that have no connections
    if (nodeType === 'auto') {
      return;
    }

    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;

    body += `    ${nodeType} ${outputVar} = ${glslCode};\n`;
  });

  return body;
}

export const compileGraphToGLSLWithReport = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  targetNodeId?: string,
  isSubgraph: boolean = false
): CompiledShaderResult => {
  const safeEdges = edges as GraphEdge[];

  // PASS 1: Generate function declarations for custom nodes (recursive)
  const customNodeFunctions: string[] = [];
  const processedCustomNodes = new Set<string>();
  // Tracks which custom nodes have a valid (non-empty) GLSL function declaration.
  // Nodes absent from this set are skipped in PASS 2 (compilation guard).
  const generatedCustomNodeIds = new Set<string>();

  // Recursive function to collect all custom nodes (including nested)
  const collectCustomNodes = (nodesToScan: GraphNode[]) => {
    nodesToScan.forEach(node => {
      const def = node.data?.definition;
      if (def && 'isCustom' in def && def.isCustom) {
        const customDef = def as CustomNodeDefinition;

        // Guard against infinite recursion (e.g. a custom node that contains itself)
        // Mark as processed BEFORE recursing into subgraph
        if (processedCustomNodes.has(customDef.id)) return;
        processedCustomNodes.add(customDef.id);

        shaderDebug.log('compiler', 'Processing custom node for function generation', { customNodeId: customDef.id });

        // Recursively collect nested custom nodes first (so dependencies appear before callers)
        if (customDef.subgraph && customDef.subgraph.nodes) {
          collectCustomNodes(customDef.subgraph.nodes as GraphNode[]);
        }

        const funcCode = generateCustomNodeFunction(
          customDef,
          (subNodes, subEdges, targetId) => {
            // Recursive compilation for subgraph body
            const subMainBody = compileSubgraphMainBody(subNodes, subEdges, targetId);
            return subMainBody;
          }
        );

        // Only register nodes whose function was successfully generated
        if (funcCode.trim()) {
          customNodeFunctions.push(funcCode);
          generatedCustomNodeIds.add(customDef.id);
        }
      }
    });
  };

  // Start collection from root nodes
  collectCustomNodes(nodes);

  shaderDebug.log('compiler', 'Generated custom node functions', { count: customNodeFunctions.length, ids: [...generatedCustomNodeIds] });

  // PASS 2: Compile main graph
  const sortedNodes = sortNodesTopologically(nodes, safeEdges, targetNodeId);
  const skippedNodeIds = new Set<string>();

  let mainBody = '';
  const nodeVarMap: Record<string, string> = {};

  sortedNodes.forEach(node => {
    const def = node.data?.definition;
    if (!def) {
      skippedNodeIds.add(node.id);
      return;
    }
    // Pomiń nody bez wyjść (chyba że to Output lub Target)
    if (def.outputs.length === 0 && def.id !== 'output' && node.id !== targetNodeId) {
      skippedNodeIds.add(node.id);
      return;
    }

    const inputs: Record<string, string> = {};

    def.inputs.forEach(inputDef => {
      const edge = safeEdges.find(e => e.target === node.id && e.targetHandle === inputDef.id);

      if (edge && nodeVarMap[edge.source]) {
        const sourceVarName = nodeVarMap[edge.source];
        const sourceNode = nodes.find(n => n.id === edge.source);

        // 1. USTALANIE TYPU ŹRÓDŁA
        // Musimy wiedzieć, jaki typ ma zmienna źródłowa, żeby ją poprawnie rzutować
        let sourceRawType = 'float';

        // Specjalna obsługa dla Splita - jego zmienna ma typ wejścia, a nie wyjścia
        if (sourceNode?.data.definition.varType) {
             sourceRawType = sourceNode.data.definition.varType;
        } else if (sourceNode?.data.definition.id.includes('split') && sourceNode.data.definition.inputs.length > 0) {
             sourceRawType = sourceNode.data.definition.inputs[0].type;
        } else {
             // Fallback do pierwszego wyjścia, gdy sourceHandle nie pasuje (np. stare zapisy z 'result')
             const sourceOutputs = sourceNode?.data.definition.outputs || [];
             sourceRawType = sourceOutputs.find(o => o.id === edge.sourceHandle)?.type || sourceOutputs[0]?.type || 'float';
        }

        // Obsługa swizzlingu (np. .x, .y, .z)
        const isSwizzled = edge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(edge.sourceHandle);

        // Jeśli swizzling, to efektywny typ to float (dla pojedynczych kanałów)
        const effectiveSourceType = isSwizzled ? 'float' : sourceRawType;
        const sourceExpression = isSwizzled ? `${sourceVarName}.${edge.sourceHandle}` : sourceVarName;

        // 2. EXPLICIT CASTING — delegate to autoCast() (same logic used in subgraph compiler)
        const targetType = inputDef.type;
        const finalExpr = autoCast(sourceExpression, effectiveSourceType, targetType);
        inputs[inputDef.id] = finalExpr;
      }
    });

    // === CUSTOM NODE COMPILATION ===
    // If this is a custom node, compile its subgraph instead of using glslTemplate
    let glslCode: string;

    // Special handling for Custom Input nodes - use external input value
    if (def.id === 'custom_input' && 'externalInput' in node.data && node.data.externalInput) {
      glslCode = node.data.externalInput;
    }
    else if ('isCustom' in def && def.isCustom) {
      const customDef = def as CustomNodeDefinition;

      // Compilation guard: skip nodes whose GLSL function wasn't generated (unready subgraph)
      if (!generatedCustomNodeIds.has(customDef.id)) {
        skippedNodeIds.add(node.id);
        shaderDebug.warn('compiler', 'Skipping unready custom node', { customNodeId: customDef.id, nodeId: node.id });
        return;
      }

      // Build parameter list from inputs
      const callParams = customDef.inputs.map(inp => {
        if (inputs[inp.id]) return inputs[inp.id];
        // Default value must match parameter type — '0.0' (float) would fail a vec3 param
        const t = inp.type === 'auto' ? 'vec3' : inp.type;
        if (t === 'float') return '0.0';
        if (t === 'vec2') return 'vec2(0.0)';
        if (t === 'vec4') return 'vec4(0.0)';
        return 'vec3(0.0)';
      }).join(', ');

      // Function call instead of inline subgraph
      glslCode = `${customDef.id}(${callParams})`;

      shaderDebug.log('compiler', 'Generated custom node function call', { nodeId: node.id, call: glslCode });
    } else {
      // Standard node - use glslTemplate (nodeId w data — szablony uniformów)
      glslCode = def.glslTemplate(inputs, { ...node.data, nodeId: node.id });
    }

    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;

    // --- TYPE DETERMINATION (FIXED) ---
    // Tu był błąd. Dla Split Node zmienna musi być typu wejściowego (wektor),
    // a nie wyjściowego (float), bo przechowuje całość do podziału.
    let nodeType = 'vec3';

    if (def.varType) {
        // Jawny override (np. audio_input: vec4 czytany swizzlem x/y/z/w)
        nodeType = def.varType;
    } else if (def.id.includes('split')) {
        // Dla Split: typ zmiennej = typ wejścia (np. vec3)
        if (node.data.definition.inputs.length > 0) {
            const inputType = node.data.definition.inputs[0].type;
            // Auto type fallback - jeśli nie podłączone, użyj vec3
            nodeType = inputType === 'auto' ? 'vec3' : inputType;
        }
    } else if (def.id === 'custom_input') {
        // Custom Input: MUSI używać detectedType (wykrytego z połączenia)!
        if (node.data.detectedType) {
            nodeType = node.data.detectedType;
        } else if (node.data.definition.outputs.length > 0) {
            const outputType = node.data.definition.outputs[0].type;
            nodeType = outputType === 'auto' ? 'vec3' : outputType;
        }
    } else if (def.id === 'custom_output') {
        // Custom Output: typ zmiennej = typ WEJŚCIA (co do niego wpływa)
        if (node.data.definition.inputs.length > 0) {
            const inputType = node.data.definition.inputs[0].type;
            nodeType = inputType === 'auto' ? 'vec3' : inputType;
        } else if (node.data.detectedType) {
            // Fallback - użyj detectedType jeśli definition nie ma inputs
            nodeType = node.data.detectedType;
        }
    } else {
        // Dla reszty: typ zmiennej = typ pierwszego wyjścia (standard)
        if (node.data.definition.outputs.length > 0) {
            const outputType = node.data.definition.outputs[0].type;
            // Auto type fallback - jeśli nie podłączone, użyj vec3
            nodeType = outputType === 'auto' ? 'vec3' : outputType;
        }
    }

    // Skip nodes with auto type that have no connections
    // (they haven't been adapted yet, so we can't compile them)
    if (nodeType === 'auto') {
        skippedNodeIds.add(node.id);
        return; // Skip this node
    }

    if (def.id !== 'output' && def.id !== 'preview') {
        mainBody += `    ${nodeType} ${outputVar} = ${glslCode};\n`;
    }
  });

  // 3. FINAL LINE GENERATION (Monitor / Output)
  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';
  const targetId = targetNodeId || nodes.find(n => n.data?.definition?.id === 'output')?.id;

  if (targetId) {
    const lastEdge = safeEdges.find(e => e.target === targetId);
    if (lastEdge && nodeVarMap[lastEdge.source]) {
      const srcNode = nodes.find(n => n.id === lastEdge.source);

      // Podobna logika dla typu źródłowego jak wyżej
      let srcType = 'float';
      if (srcNode?.data.definition.varType) {
          srcType = srcNode.data.definition.varType;
      } else if (srcNode?.data.definition.id.includes('split')) {
          srcType = srcNode.data.definition.inputs[0].type;
      } else {
          // Fallback do pierwszego wyjścia, gdy sourceHandle nie pasuje (np. stare zapisy z 'result')
          const srcOutputs = srcNode?.data.definition.outputs || [];
          srcType = srcOutputs.find(o => o.id === lastEdge.sourceHandle)?.type || srcOutputs[0]?.type || 'float';
      }

      const isSwizzled = lastEdge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(lastEdge.sourceHandle);
      if (isSwizzled) srcType = 'float';

      let varName = nodeVarMap[lastEdge.source];
      if (isSwizzled) varName += `.${lastEdge.sourceHandle}`;

      // JAWNE RZUTOWANIE NA VEC4 (Dla gl_FragColor)
      if (srcType === 'vec4') finalLine = `gl_FragColor = ${varName};`;
      else if (srcType === 'vec3') finalLine = `gl_FragColor = vec4(${varName}, 1.0);`;
      else if (srcType === 'vec2') finalLine = `gl_FragColor = vec4(${varName}, 0.0, 1.0);`;
      else if (srcType === 'float') finalLine = `gl_FragColor = vec4(vec3(${varName}), 1.0);`;
    }
  }

  // If this is a subgraph compilation, return only the mainBody (no uniforms/precision)
  if (isSubgraph) {
    const debugReport = createCompilerDebugReport({
      nodes,
      edges,
      sortedNodes,
      generatedCustomNodeIds,
      skippedNodeIds,
      targetNodeId,
      isSubgraph,
      finalLine,
      shaderLength: mainBody.length,
    });

    shaderDebug.log('compiler', 'Compiled shader graph', {
      ...debugReport,
      summary: `subgraph | nodes=${debugReport.nodeCount} | edges=${debugReport.edgeCount} | skipped=${debugReport.skippedNodeIds.length}`,
    });

    return {
      shader: mainBody,
      debugReport,
    };
  }

  // Concatenate custom functions + main
  const functionsSection = customNodeFunctions.join('\n');

  // Uniformy zasobów (tekstury, audio) — deklarowane tylko gdy graf ich używa
  const resourceUniforms = buildUniformDeclarations(collectRuntimeResources(nodes));

  const shader = `
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
${resourceUniforms}

    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263,0.416,0.557);
        return a + b*cos( 6.28318*(c*t+d) );
    }
${functionsSection}
    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
        vec2 uv0 = uv;

        ${mainBody}

        ${finalLine}
    }
  `;

  const debugReport = createCompilerDebugReport({
    nodes,
    edges,
    sortedNodes,
    generatedCustomNodeIds,
    skippedNodeIds,
    targetNodeId,
    isSubgraph,
    finalLine,
    shaderLength: shader.length,
  });

  shaderDebug.log('compiler', 'Compiled shader graph', {
    ...debugReport,
    summary: `nodes=${debugReport.nodeCount} | edges=${debugReport.edgeCount} | custom=${debugReport.generatedCustomNodeIds.length} | skipped=${debugReport.skippedNodeIds.length} | shaderLength=${debugReport.shaderLength}`,
  });

  return {
    shader,
    debugReport,
  };
};

export const compileGraphToGLSL = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  targetNodeId?: string,
  isSubgraph: boolean = false
): string => {
  return compileGraphToGLSLWithReport(nodes, edges, targetNodeId, isSubgraph).shader;
};
