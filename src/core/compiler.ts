import type { ShaderNodeDefinition } from './types';

export interface GraphNode {
  id: string;
  type: string;
  data: {
    definition: ShaderNodeDefinition;
  };
}

interface GraphEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
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

export const compileGraphToGLSL = (nodes: GraphNode[], edges: GraphEdge[], targetNodeId?: string): string => {
  const safeEdges = edges as GraphEdge[];
  const sortedNodes = sortNodesTopologically(nodes, safeEdges, targetNodeId);
  
  let mainBody = '';
  const nodeVarMap: Record<string, string> = {};

  sortedNodes.forEach(node => {
    const def = node.data?.definition;
    if (!def) return;
    // Pomiń nody bez wyjść (chyba że to Output lub Target)
    if (def.outputs.length === 0 && def.id !== 'output' && node.id !== targetNodeId) return;
    
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
        if (sourceNode?.data.definition.id.includes('split') && sourceNode.data.definition.inputs.length > 0) {
             sourceRawType = sourceNode.data.definition.inputs[0].type;
        } else {
             sourceRawType = sourceNode?.data.definition.outputs.find(o => o.id === edge.sourceHandle)?.type || 'float';
        }

        // Obsługa swizzlingu (np. .x, .y, .z)
        const isSwizzled = edge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(edge.sourceHandle);
        
        // Jeśli swizzling, to efektywny typ to float (dla pojedynczych kanałów)
        const effectiveSourceType = isSwizzled ? 'float' : sourceRawType;
        const sourceExpression = isSwizzled ? `${sourceVarName}.${edge.sourceHandle}` : sourceVarName;

        // 2. JAWNA KONWERSJA (EXPLICIT CASTING)
        // GLSL nie wybacza. Musimy użyć konstruktorów.
        const targetType = inputDef.type;
        let finalExpr = sourceExpression;

        if (effectiveSourceType !== targetType) {
          if (targetType === 'float') {
            if (['vec2', 'vec3', 'vec4'].includes(effectiveSourceType)) finalExpr = `${sourceExpression}.x`;
          } 
          else if (targetType === 'vec2') {
            if (effectiveSourceType === 'float') finalExpr = `vec2(${sourceExpression})`;
            else if (effectiveSourceType === 'vec3' || effectiveSourceType === 'vec4') finalExpr = `${sourceExpression}.xy`;
          } 
          else if (targetType === 'vec3') {
            if (effectiveSourceType === 'float') finalExpr = `vec3(${sourceExpression})`;
            else if (effectiveSourceType === 'vec2') finalExpr = `vec3(${sourceExpression}, 0.0)`;
            else if (effectiveSourceType === 'vec4') finalExpr = `${sourceExpression}.xyz`;
          } 
          else if (targetType === 'vec4') {
            if (effectiveSourceType === 'float') finalExpr = `vec4(${sourceExpression}, ${sourceExpression}, ${sourceExpression}, 1.0)`;
            else if (effectiveSourceType === 'vec2') finalExpr = `vec4(${sourceExpression}, 0.0, 1.0)`;
            else if (effectiveSourceType === 'vec3') finalExpr = `vec4(${sourceExpression}, 1.0)`;
          }
        }
        inputs[inputDef.id] = finalExpr;
      }
    });

    const glslCode = def.glslTemplate(inputs, node.data);
    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;
    
    // --- TYPE DETERMINATION (FIXED) ---
    // Tu był błąd. Dla Split Node zmienna musi być typu wejściowego (wektor), 
    // a nie wyjściowego (float), bo przechowuje całość do podziału.
    let nodeType = 'vec3';
    
    if (def.id.includes('split')) {
        // Dla Split: typ zmiennej = typ wejścia (np. vec3)
        if (node.data.definition.inputs.length > 0) {
            nodeType = node.data.definition.inputs[0].type;
        }
    } else {
        // Dla reszty: typ zmiennej = typ pierwszego wyjścia (standard)
        if (node.data.definition.outputs.length > 0) {
            nodeType = node.data.definition.outputs[0].type;
        }
    }
    
    if (def.id !== 'output' && def.id !== 'preview') {
        mainBody += `    ${nodeType} ${outputVar} = ${glslCode};\n`;
    }
  });

  // 3. FINAL LINE GENERATION (Monitor / Output)
  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';
  const targetId = targetNodeId || nodes.find(n => n.data.definition.id === 'output')?.id;

  if (targetId) {
    const lastEdge = safeEdges.find(e => e.target === targetId);
    if (lastEdge && nodeVarMap[lastEdge.source]) {
      const srcNode = nodes.find(n => n.id === lastEdge.source);
      
      // Podobna logika dla typu źródłowego jak wyżej
      let srcType = 'float';
      if (srcNode?.data.definition.id.includes('split')) {
          srcType = srcNode.data.definition.inputs[0].type;
      } else {
          srcType = srcNode?.data.definition.outputs.find(o => o.id === lastEdge.sourceHandle)?.type || 'float';
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

  return `
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
    
    vec3 palette( in float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263,0.416,0.557);
        return a + b*cos( 6.28318*(c*t+d) );
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
        vec2 uv0 = uv;
        
        ${mainBody}
        
        ${finalLine}
    }
  `;
};