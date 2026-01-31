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

const sortNodesTopologically = (nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] => {
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
  nodes.forEach(node => visit(node.id));
  return sorted;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const compileGraphToGLSL = (nodes: GraphNode[], edges: any[]): string => {
  console.groupCollapsed('🛠️ [Compiler] Generowanie (Split Fix)...');
  
  const safeEdges = edges as GraphEdge[];
  const sortedNodes = sortNodesTopologically(nodes, safeEdges);
  let mainBody = '';
  const nodeVarMap: Record<string, string> = {};

  sortedNodes.forEach(node => {
    const def = node.data?.definition;
    if (!def) return;
    if (def.outputs.length === 0 && def.id !== 'output') {
        return; 
    }
    
    const inputs: Record<string, string> = {}; 
    
    def.inputs.forEach(inputDef => {
      const potentialEdges = safeEdges.filter(e => e.target === node.id && e.targetHandle === inputDef.id);
      const validEdge = potentialEdges.find(e => nodeVarMap[e.source]);
      
      if (validEdge) {
        let sourceVarName = `var_${validEdge.source.replace(/-/g, '_')}`;
        
        // --- SWIZZLING ---
        const swizzleChannels = ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'];
        let isSwizzled = false;

        if (validEdge.sourceHandle && swizzleChannels.includes(validEdge.sourceHandle)) {
            sourceVarName += `.${validEdge.sourceHandle}`;
            isSwizzled = true;
        }

        // --- AUTO-KONWERSJA ---
        const sourceNode = nodes.find(n => n.id === validEdge.source);
        let finalExpression = sourceVarName;

        if (sourceNode?.data?.definition) {
             let sourceType = sourceNode.data.definition.outputs?.[0]?.type || 'float';
             
             // Fix: Jeśli użyliśmy .x, .y, to typ źródła to zawsze float
             if (isSwizzled) {
                 sourceType = 'float';
             }
             // Fix 2: Jeśli źródło to SplitNode, to jego "główny typ" to typ jego wejścia (kontenera)
             // ale tutaj SourceVarName ma już dopisane .x, więc sourceType=float powyżej załatwia sprawę.

             const targetType = inputDef.type;

             // 1. Float -> Vec3
             if (targetType === 'vec3' && sourceType === 'float') {
                finalExpression = `vec3(${sourceVarName})`;
             }
             // 2. Vec2 -> Vec3
             else if (targetType === 'vec3' && sourceType === 'vec2') {
                finalExpression = `vec3(${sourceVarName}, 0.0)`;
             }
             // 3. Float -> Vec2
             else if (targetType === 'vec2' && sourceType === 'float') {
                finalExpression = `vec2(${sourceVarName})`;
             }
        }

        inputs[inputDef.id] = finalExpression;
        console.log(`   🔗 ${node.id} (${inputDef.id}) <- ${finalExpression}`);
      }
    });

    const glslCode = def.glslTemplate(inputs, node.data);
    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;
    
    // --- FIX: DETEKCJA TYPU ZMIENNEJ ---
    let type = def.outputs.length > 0 ? def.outputs[0].type : 'vec3';
    
    // Jeśli to node typu SPLIT, musimy przechować CAŁY wektor wejściowy w zmiennej,
    // a nie tylko typ pierwszego wyjścia (który jest floatem).
    if (def.id.includes('split') && def.inputs.length > 0) {
        type = def.inputs[0].type;
        console.log(`   ℹ️ Split Node wykryty: Ustawiam typ kontenera na ${type}`);
    }
    
    const line = `    ${type} ${outputVar} = ${glslCode};\n`;
    mainBody += line;
  });

  const outputNode = nodes.find(n => n.data?.definition?.id === 'output');
  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';

  if (outputNode && nodeVarMap[outputNode.id]) {
    finalLine = `gl_FragColor = vec4(${nodeVarMap[outputNode.id]}, 1.0);`;
  }

  const shader = `
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
  
  console.log(shader);
  console.groupEnd();
  return shader;
};