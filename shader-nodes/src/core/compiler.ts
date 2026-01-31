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

// Funkcja sortująca zależna od celu (targetNodeId)
const sortNodesTopologically = (nodes: GraphNode[], edges: GraphEdge[], targetNodeId?: string): GraphNode[] => {
  const visited = new Set<string>();
  const sorted: GraphNode[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    // Odwiedzamy zależności (inputy)
    const inputEdges = edges.filter(e => e.target === nodeId);
    inputEdges.forEach(edge => visit(edge.source));
    
    const node = nodeMap.get(nodeId);
    if (node) sorted.push(node);
  };

  // Jeśli podano cel, startujemy TYLKO od niego (budujemy tylko potrzebny fragment)
  if (targetNodeId) {
      visit(targetNodeId);
  } else {
      // Domyślnie (pełny graf) - szukamy outputu lub odwiedzamy wszystko
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
    // Ignoruj nody bez wyjść (chyba że to cel)
    if (def.outputs.length === 0 && def.id !== 'output' && node.id !== targetNodeId) {
        return; 
    }
    
    const inputs: Record<string, string> = {}; 
    
    def.inputs.forEach(inputDef => {
      const potentialEdges = safeEdges.filter(e => e.target === node.id && e.targetHandle === inputDef.id);
      const validEdge = potentialEdges.find(e => nodeVarMap[e.source]);
      
      if (validEdge) {
        let sourceVarName = `var_${validEdge.source.replace(/-/g, '_')}`;
        
        // Swizzling logic...
        const swizzleChannels = ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'];
        let isSwizzled = false;
        if (validEdge.sourceHandle && swizzleChannels.includes(validEdge.sourceHandle)) {
            sourceVarName += `.${validEdge.sourceHandle}`;
            isSwizzled = true;
        }

        // Auto-konwersja typów (uproszczona dla czytelności)
        const sourceNode = nodes.find(n => n.id === validEdge.source);
        let finalExpression = sourceVarName;

        if (sourceNode?.data?.definition) {
             let sourceType = sourceNode.data.definition.outputs?.[0]?.type || 'float';
             if (isSwizzled) sourceType = 'float';
             
             const targetType = inputDef.type;
             if (targetType === 'vec3' && sourceType === 'float') finalExpression = `vec3(${sourceVarName})`;
             else if (targetType === 'vec3' && sourceType === 'vec2') finalExpression = `vec3(${sourceVarName}, 0.0)`;
             else if (targetType === 'vec2' && sourceType === 'float') finalExpression = `vec2(${sourceVarName})`;
        }
        inputs[inputDef.id] = finalExpression;
      }
    });

    const glslCode = def.glslTemplate(inputs, node.data);
    const outputVar = `var_${node.id.replace(/-/g, '_')}`;
    nodeVarMap[node.id] = outputVar;
    
    let type = def.outputs.length > 0 ? def.outputs[0].type : 'vec3';
    if (def.id.includes('split') && def.inputs.length > 0) type = def.inputs[0].type;
    
    // Nie generujemy zmiennej dla OutputNode ani PreviewNode (one tylko konsumują)
    if (def.id !== 'output' && def.id !== 'preview') {
        const line = `    ${type} ${outputVar} = ${glslCode};\n`;
        mainBody += line;
    }
  });

  // --- FINAL LINE GENERATION ---
  let finalLine = 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';

  // 1. Jeśli budujemy dla konkretnego noda (Preview)
  if (targetNodeId) {
      const targetNode = nodes.find(n => n.id === targetNodeId);
      // Musimy znaleźć, co wchodzi do preview noda
      const inputEdge = safeEdges.find(e => e.target === targetNodeId);
      
      if (inputEdge && nodeVarMap[inputEdge.source]) {
          let varName = nodeVarMap[inputEdge.source];
          if (inputEdge.sourceHandle && ['x','y','z','w','r','g','b','a'].includes(inputEdge.sourceHandle)) {
              varName += `.${inputEdge.sourceHandle}`;
          }
          
          // Zgadujemy typ źródła, żeby dobrze wyświetlić
          // (Dla uproszczenia zakładamy że wszystko konwertujemy na vec3)
          // WGLSL vec4(float) = grayscale, vec4(vec3, 1.0) = color
          // Ale najbezpieczniej:
          finalLine = `
          vec3 finalCol = vec3(0.0);
          // Try to intelligent cast
          // We don't know the exact type here easily without tracking, so we rely on GLSL overloading constructors
          // or we just assume vec3. Let's try a generic cast wrapper logic in GLSL? No, too complex.
          // Simple heuristic:
          finalCol = vec3(${varName}); 
          gl_FragColor = vec4(finalCol, 1.0);`;
      }
  } 
  // 2. Standardowy Output
  else {
      const outputNode = nodes.find(n => n.data?.definition?.id === 'output');
      if (outputNode) {
          // Szukamy co wchodzi do outputu
          const inputEdge = safeEdges.find(e => e.target === outputNode.id);
          if (inputEdge && nodeVarMap[inputEdge.source]) {
               finalLine = `gl_FragColor = vec4(vec3(${nodeVarMap[inputEdge.source]}), 1.0);`;
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