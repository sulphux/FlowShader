import type { ShaderNodeDefinition } from './types';
import type { CustomNodeDefinition } from './customNodeManager';
import { generateCustomNodeFunction, autoCast, customNodeFunctionName, sanitizeGLSLIdentifier, toGLSLType } from './functionGenerator';
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
    const node = nodeMap.get(nodeId);
    // Feedback is a frame boundary: its stored output never depends on its
    // current-frame In/Impulse while compiling a consumer. UV is different —
    // it controls where the already stored texture is sampled, so it remains
    // a normal dependency. This deliberately makes simulation loops legal.
    const inputEdges = edges.filter(e => e.target === nodeId && (
      node?.data?.definition?.id !== 'feedback' || e.targetHandle === 'uv'
    ));
    inputEdges.forEach(edge => visit(edge.source));
    if (node) sorted.push(node);
  };

  if (targetNodeId) visit(targetNodeId);
  else nodes.forEach(node => visit(node.id));

  return sorted;
};

/**
 * A GLSL function returns exactly one value, so a custom node with several
 * differently-typed output ports (e.g. vec2 "Image Process OUT" + vec3
 * "Color OUT") compiles to one function PER PORT (customNodeFunctionName) —
 * unlike built-in multi-output nodes (audio_input, smart_split), whose
 * outputs are just swizzled channels of one shared vector, custom node ports
 * can be arbitrary unrelated types with no single vector to swizzle.
 * multiOutputVarMap tracks nodeId -> portId -> variable name so edges whose
 * sourceHandle picks a specific port resolve to the right one.
 */
type MultiOutputVarMap = Record<string, Record<string, string>>;

const isMultiOutputCustomNode = (def: ShaderNodeDefinition): def is CustomNodeDefinition =>
  'isCustom' in def && Boolean((def as CustomNodeDefinition).isCustom) && def.outputs.length > 1;

/** Declares one variable per output port, calling that port's generated function. */
function emitMultiOutputCustomNode(
  node: GraphNode,
  customDef: CustomNodeDefinition,
  callParams: string,
  multiOutputVarMap: MultiOutputVarMap
): string {
  let body = '';
  const ports: Record<string, string> = {};
  const glslId = node.id.replace(/-/g, '_');
  customDef.outputs.forEach(port => {
    const funcName = customNodeFunctionName(customDef, port);
    // GLSL ES reserves identifiers containing "__" — collapse any run of
    // underscores from the id/port concatenation down to one.
    const varName = `var_${glslId}_o_${sanitizeGLSLIdentifier(port.id)}`.replace(/_+/g, '_');
    const type = toGLSLType(port.type);
    body += `    ${type} ${varName} = ${funcName}(${callParams});\n`;
    ports[port.id] = varName;
  });
  multiOutputVarMap[node.id] = ports;
  return body;
}

/**
 * Resolves the expression + type to use when an edge consumes a source
 * node's output. Checks multiOutputVarMap first (custom node with several
 * ports, each its own variable); otherwise falls back to the legacy single
 * shared variable, optionally swizzled (built-in multi-output nodes, or a
 * custom node with exactly one port).
 */
function resolveSourceExpr(
  edge: GraphEdge,
  sourceNode: GraphNode | undefined,
  nodeVarMap: Record<string, string>,
  multiOutputVarMap: MultiOutputVarMap
): { expr: string; type: string } | undefined {
  const ports = multiOutputVarMap[edge.source];
  if (ports && edge.sourceHandle && ports[edge.sourceHandle]) {
    const def = sourceNode?.data.definition as CustomNodeDefinition | undefined;
    const port = def?.outputs.find(o => o.id === edge.sourceHandle);
    const type = (!port?.type || port.type === 'auto') ? 'vec3' : port.type;
    return { expr: ports[edge.sourceHandle], type };
  }

  const sourceVarName = nodeVarMap[edge.source];
  if (!sourceVarName) return undefined;

  let sourceRawType = 'float';
  if (sourceNode?.data.definition.varType) {
    sourceRawType = sourceNode.data.definition.varType;
  } else if (sourceNode?.data.definition.id.includes('split') && sourceNode.data.definition.inputs.length > 0) {
    sourceRawType = sourceNode.data.definition.inputs[0].type;
  } else if (sourceNode?.data.definition.id === 'custom_input') {
    // Custom Input inside a subgraph: use its detected type (falls back to
    // the port's own declared type, which self-heals stale/legacy saves)
    sourceRawType = sourceNode.data.detectedType || sourceNode.data.definition.outputs[0]?.type || 'float';
  } else {
    // Fallback do pierwszego wyjścia, gdy sourceHandle nie pasuje (np. stare zapisy z 'result')
    const outputs = sourceNode?.data.definition.outputs || [];
    sourceRawType = outputs.find(o => o.id === edge.sourceHandle)?.type || outputs[0]?.type || 'float';
  }

  const isSwizzled = Boolean(edge.sourceHandle && ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'].includes(edge.sourceHandle));
  const type = isSwizzled ? 'float' : sourceRawType;
  const expr = isSwizzled ? `${sourceVarName}.${edge.sourceHandle}` : sourceVarName;
  return { expr, type };
}

/**
 * Compile subgraph body (no uniforms/precision/main wrapper)
 * Used for generating custom node function bodies
 */
function compileSubgraphMainBody(nodes: GraphNode[], edges: GraphEdge[], targetNodeId: string): string {
  const safeEdges = edges as GraphEdge[];
  const sortedNodes = sortNodesTopologically(nodes, safeEdges, targetNodeId);

  let body = '';
  const nodeVarMap: Record<string, string> = {};
  const multiOutputVarMap: MultiOutputVarMap = {};

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
      if (!edge) return;
      const sourceNode = nodes.find(n => n.id === edge.source);
      const resolved = resolveSourceExpr(edge, sourceNode, nodeVarMap, multiOutputVarMap);
      if (!resolved) return;

      // Auto-cast to target type
      inputs[inputDef.id] = autoCast(resolved.expr, resolved.type, inputDef.type);
    });

    // Multi-output custom node used inside a subgraph (nested custom node)
    if (isMultiOutputCustomNode(def)) {
      const callParams = def.inputs.map(inp => {
        if (inputs[inp.id]) return inputs[inp.id];
        const glslType = toGLSLType(inp.type);
        return glslType === 'float' ? '0.0' : `${glslType}(0.0)`;
      }).join(', ');
      body += emitMultiOutputCustomNode(node, def, callParams, multiOutputVarMap);
      nodeVarMap[node.id] = multiOutputVarMap[node.id][def.outputs[0].id];
      return;
    }

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

    body += `    ${toGLSLType(nodeType)} ${outputVar} = ${glslCode};\n`;
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

        const compileBody = (subNodes: GraphNode[], subEdges: GraphEdge[], targetId: string) =>
          compileSubgraphMainBody(subNodes, subEdges, targetId);

        // One GLSL function per output port — see MultiOutputVarMap doc above.
        const ports = customDef.outputs.length > 1 ? customDef.outputs : [customDef.outputs[0]];
        ports.forEach(port => {
          const funcCode = generateCustomNodeFunction(customDef, compileBody, port);
          // Only register nodes whose function was successfully generated
          if (funcCode.trim()) {
            customNodeFunctions.push(funcCode);
            generatedCustomNodeIds.add(customDef.id);
          }
        });
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
  const multiOutputVarMap: MultiOutputVarMap = {};

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
      if (!edge) return;
      const sourceNode = nodes.find(n => n.id === edge.source);
      const resolved = resolveSourceExpr(edge, sourceNode, nodeVarMap, multiOutputVarMap);
      if (!resolved) return;
      inputs[inputDef.id] = autoCast(resolved.expr, resolved.type, inputDef.type);
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
        const t = toGLSLType(inp.type);
        if (t === 'float') return '0.0';
        if (t === 'vec2') return 'vec2(0.0)';
        if (t === 'vec4') return 'vec4(0.0)';
        return 'vec3(0.0)';
      }).join(', ');

      // Multiple output ports: one function + one variable per port (see
      // MultiOutputVarMap doc) instead of the single-line emit below.
      if (isMultiOutputCustomNode(customDef)) {
        mainBody += emitMultiOutputCustomNode(node, customDef, callParams, multiOutputVarMap);
        nodeVarMap[node.id] = multiOutputVarMap[node.id][customDef.outputs[0].id];
        return;
      }

      // Function call instead of inline subgraph
      glslCode = `${customNodeFunctionName(customDef)}(${callParams})`;

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

    // Nody czysto wizualne (pusty glslTemplate) nie emitują zmiennej —
    // emisja dałaby "vec3 var = ;" i błąd składni GLSL
    if (def.id !== 'output' && def.id !== 'preview' && def.id !== 'color_preview') {
        mainBody += `    ${toGLSLType(nodeType)} ${outputVar} = ${glslCode};\n`;
    }
  });

  // 3. FINAL LINE GENERATION (Monitor / Output)
  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';
  const targetId = targetNodeId || nodes.find(n => n.data?.definition?.id === 'output')?.id;

  if (targetId) {
    const lastEdge = safeEdges.find(e => e.target === targetId);
    if (lastEdge) {
      const srcNode = nodes.find(n => n.id === lastEdge.source);
      const resolved = resolveSourceExpr(lastEdge, srcNode, nodeVarMap, multiOutputVarMap);

      if (resolved) {
        // Unresolved custom-node port (e.g. its Custom Output was never wired
        // inside the subgraph) — same vec3 fallback as everywhere else here,
        // otherwise this silently drops the result and renders solid black.
        const srcType = toGLSLType(resolved.type);
        const varName = resolved.expr;

        // JAWNE RZUTOWANIE NA VEC4 (Dla gl_FragColor)
        if (srcType === 'vec4') finalLine = `gl_FragColor = ${varName};`;
        else if (srcType === 'vec3') finalLine = `gl_FragColor = vec4(${varName}, 1.0);`;
        else if (srcType === 'vec2') finalLine = `gl_FragColor = vec4(${varName}, 0.0, 1.0);`;
        else if (srcType === 'float') finalLine = `gl_FragColor = vec4(vec3(${varName}), 1.0);`;
      }
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

    // Globals (assigned at the top of main) — custom node functions compile
    // node templates like UV Coord to the bare identifier 'uv', so it must be
    // visible at function scope, not a local of main().
    vec2 uv;
    vec2 uv0;
    // Pixel-aligned 0..1 coordinates. Unlike the centered UV, these do not carry the
    // render target's aspect ratio and are safe for screen-sized buffers.
    vec2 screenUv;

    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263,0.416,0.557);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
${functionsSection}
    void main() {
        uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
        uv0 = uv;
        screenUv = gl_FragCoord.xy / iResolution.xy;

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

/**
 * Compiles a node's output as a preview target without changing the real
 * graph. Normal targetNodeId compilation expects a sink node (Output,
 * Preview, Monitor); this helper adds such a sink virtually so stateful
 * source nodes like Frame Buffer can preview their own stored output.
 */
export const compileNodeOutputToGLSL = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceNodeId: string,
  sourceHandle?: string
): string => {
  const sourceNode = nodes.find(node => node.id === sourceNodeId);
  const output = sourceNode?.data?.definition?.outputs.find(port => port.id === sourceHandle)
    ?? sourceNode?.data?.definition?.outputs[0];
  const targetId = `frame_buffer_preview_target_${sourceNodeId}`;
  const targetDefinition: ShaderNodeDefinition = {
    id: 'preview',
    label: 'Node Output Preview Target',
    inputs: [{ id: 'in', label: 'In', type: output?.type || 'vec3' }],
    outputs: [],
    glslTemplate: () => '',
  };
  const targetNode: GraphNode = {
    id: targetId,
    type: 'previewNode',
    data: { definition: targetDefinition },
  };
  const previewEdge: GraphEdge = {
    source: sourceNodeId,
    sourceHandle: output?.id || sourceHandle || null,
    target: targetId,
    targetHandle: 'in',
  };
  return compileGraphToGLSL([...nodes, targetNode], [...edges, previewEdge], targetId);
};
