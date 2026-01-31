import { NODE_REGISTRY } from '../nodes';
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

  if (targetNodeId) {
      visit(targetNodeId);
  } else {
      nodes.forEach(node => visit(node.id));
  }
  
  return sorted;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const compileGraphToGLSL = (nodes: GraphNode[], edges: any[], targetNodeId?: string): string => {
  const safeEdges = edges as GraphEdge[];
  const sortedNodes = sortNodesTopologically(nodes, safeEdges, targetNodeId);
  
  let mainBody = '';
  const nodeVarMap: Record<string, string> = {};

  sortedNodes.forEach(node => {
    const def = node.data?.definition;
    if (!def) return;
    if (def.outputs.length === 0 && def.id !== 'output' && node.id !== targetNodeId) {
        return; 
    }
    
    const inputs: Record<string, string> = {}; 
    
    def.inputs.forEach(inputDef => {
      const potentialEdges = safeEdges.filter(e => e.target === node.id && e.targetHandle === inputDef.id);
      const validEdge = potentialEdges.find(e => nodeVarMap[e.source]);
      
      if (validEdge) {
        let sourceVarName = `var_${validEdge.source.replace(/-/g, '_')}`;
        
        const swizzleChannels = ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'];
        let isSwizzled = false;
        if (validEdge.sourceHandle && swizzleChannels.includes(validEdge.sourceHandle)) {
            sourceVarName += `.${validEdge.sourceHandle}`;
            isSwizzled = true;
        }

        const sourceNode = nodes.find(n => n.id === validEdge.source);
        let finalExpression = sourceVarName;

        if (sourceNode?.data?.definition) {
             let sourceType = sourceNode.data.definition.outputs?.[0]?.type || 'float';
             if (isSwizzled) sourceType = 'float';
             
             const targetType = inputDef.type;

             // --- AUTO-CASTING (Wewnątrz grafu) ---
             if (targetType === 'vec4') {
                 if (sourceType === 'float') finalExpression = `vec4(${sourceVarName}, ${sourceVarName}, ${sourceVarName}, 1.0)`;
                 else if (sourceType === 'vec2') finalExpression = `vec4(${sourceVarName}, 0.0, 1.0)`;
                 else if (sourceType === 'vec3') finalExpression = `vec4(${sourceVarName}, 1.0)`;
             }
             else if (targetType === 'vec3') {
                 if (sourceType === 'float') finalExpression = `vec3(${sourceVarName})`;
                 else if (sourceType === 'vec2') finalExpression = `vec3(${sourceVarName}, 0.0)`;
                 else if (sourceType === 'vec4') finalExpression = `vec3(${sourceVarName})`; 
             }
             else if (targetType === 'vec2') {
                 if (sourceType === 'float') finalExpression = `vec2(${sourceVarName})`;
                 else if (sourceType === 'vec3' || sourceType === 'vec4') finalExpression = `vec2(${sourceVarName})`; 
             }
             // COMPOSE FIX: Jeśli wejście to float, a podłączono wektor -> wyciągamy X
             else if (targetType === 'float') {
                 if (['vec2', 'vec3', 'vec4'].includes(sourceType)) finalExpression = `${sourceVarName}.x`;
             }
        }
        inputs[inputDef.id] = finalExpression;
      }
    });

    const glslCode = def.glslTemplate(inputs, node.data);
    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;
    
    let type = def.outputs.length > 0 ? def.outputs[0].type : 'vec3';
    // Fix dla Smart Node: typ zmiennej musi zgadzać się z definicją (dynamiczną)
    if (node.data.definition.outputs.length > 0) {
        type = node.data.definition.outputs[0].type;
    }
    
    if (def.id !== 'output' && def.id !== 'preview') {
        const line = `    ${type} ${outputVar} = ${glslCode};\n`;
        mainBody += line;
    }
  });

  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';

  // --- FINAL LINE GENERATION (Fix dla Monitora i Outputu) ---
  if (targetNodeId) {
      const targetNode = nodes.find(n => n.id === targetNodeId);
      const inputEdge = safeEdges.find(e => e.target === targetNodeId);
      
      if (inputEdge && nodeVarMap[inputEdge.source]) {
          let varName = nodeVarMap[inputEdge.source];
          
          let isSwizzled = false;
          if (inputEdge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(inputEdge.sourceHandle)) {
              varName += `.${inputEdge.sourceHandle}`;
              isSwizzled = true;
          }

          const sourceNode = nodes.find(n => n.id === inputEdge.source);
          let sourceType = sourceNode?.data?.definition?.outputs?.[0]?.type || 'vec3';
          if (isSwizzled) sourceType = 'float';

          // BRUTALNE RZUTOWANIE DO VEC4 (DLA MONITORA)
          if (sourceType === 'float') {
              finalLine = `gl_FragColor = vec4(${varName}, ${varName}, ${varName}, 1.0);`;
          } else if (sourceType === 'vec2') {
              finalLine = `gl_FragColor = vec4(${varName}, 0.0, 1.0);`;
          } else if (sourceType === 'vec3') {
              finalLine = `gl_FragColor = vec4(${varName}, 1.0);`;
          } else if (sourceType === 'vec4') {
              finalLine = `gl_FragColor = ${varName};`;
          } else {
              // Fallback
              finalLine = `gl_FragColor = vec4(vec3(${varName}), 1.0);`;
          }
      }
  } 
  else {
      // Logic for Main Output Node (to samo, ale prościej)
      const outputNode = nodes.find(n => n.data?.definition?.id === 'output');
      if (outputNode) {
          const inputEdge = safeEdges.find(e => e.target === outputNode.id);
          if (inputEdge && nodeVarMap[inputEdge.source]) {
               const srcNode = nodes.find(n => n.id === inputEdge.source);
               let srcType = srcNode?.data?.definition?.outputs?.[0]?.type || 'vec3';
               let vName = nodeVarMap[inputEdge.source];

               if (srcType === 'float') finalLine = `gl_FragColor = vec4(vec3(${vName}), 1.0);`;
               else if (srcType === 'vec2') finalLine = `gl_FragColor = vec4(${vName}, 0.0, 1.0);`;
               else if (srcType === 'vec3') finalLine = `gl_FragColor = vec4(${vName}, 1.0);`;
               else if (srcType === 'vec4') finalLine = `gl_FragColor = ${vName};`;
          }
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