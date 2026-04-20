import type { CustomNodeDefinition } from './customNodeManager';
import type { GraphNode, GraphEdge } from './compiler';

/**
 * Generate GLSL function declaration for custom node
 */
export function generateCustomNodeFunction(
  customDef: CustomNodeDefinition,
  compileSubgraphBody: (nodes: GraphNode[], edges: GraphEdge[], targetNodeId: string) => string
): string {
  // Use the outer node's declared ports as the ONE source of truth for the function signature.
  // Re-deriving from the subgraph here would diverge from customDef.inputs if they were set
  // via a different code path (e.g. handleCreateCustomNode on empty selection).
  const inputs = customDef.inputs;
  const outputs = customDef.outputs;
  
  console.log('🔧 generateCustomNodeFunction:', {
    nodeId: customDef.id,
    inputs: inputs.map(i => ({ id: i.id, type: i.type })),
    outputs: outputs.map(o => ({ id: o.id, type: o.type }))
  });
  
  // 'auto' is not a valid GLSL type — fall back to vec3 when type is not yet determined
  const toGLSLType = (t: string) => (!t || t === 'auto') ? 'vec3' : t;

  // Return type from first output
  const returnType = toGLSLType(outputs[0]?.type ?? '');
  
  // Parameters from inputs — sanitize IDs for GLSL (hyphens not allowed in identifiers)
  const params = inputs.map(inp => `${toGLSLType(inp.type)} ${inp.id.replace(/-/g, '_')}`).join(', ');
  
  // Compile subgraph body
  // Replace Custom Input nodes with parameter references
  const subgraphNodes = customDef.subgraph.nodes.map(node => {
    if (node.data.definition.id === 'custom_input') {
      // Mark as parameter (will be skipped in compilation)
      return { ...node, data: { ...node.data, isParameter: true } };
    }
    return node;
  });
  
  // Compile subgraph targeting Custom Output
  const outputNode = customDef.subgraph.nodes.find(n => n.data.definition.id === 'custom_output');
  
  if (!outputNode) {
    console.error('❌ No Custom Output node found in subgraph!');
    return '';
  }
  
  const body = compileSubgraphBody(subgraphNodes as GraphNode[], customDef.subgraph.edges as GraphEdge[], outputNode.id);
  
  // Get output variable name
  const outputVar = `var_${outputNode.id.replace(/-/g, '_')}`;
  
  const functionCode = `
${returnType} ${customDef.id}(${params}) {
${body}    return ${outputVar};
}
`;
  
  console.log('✅ Generated function:', functionCode);
  
  return functionCode;
}

/**
 * Auto-cast expression to target type
 */
export function autoCast(expr: string, fromType: string, toType: string): string {
  if (fromType === toType) return expr;
  
  // float → vecN
  if (fromType === 'float') {
    if (toType === 'vec2') return `vec2(${expr})`;
    if (toType === 'vec3') return `vec3(${expr})`;
    if (toType === 'vec4') return `vec4(${expr})`;
  }
  
  // vecN → float (take first component)
  if (toType === 'float') {
    return `(${expr}).x`;
  }
  
  // vec2 → vec3
  if (fromType === 'vec2' && toType === 'vec3') {
    return `vec3(${expr}, 0.0)`;
  }
  
  // vec3 → vec2
  if (fromType === 'vec3' && toType === 'vec2') {
    return `(${expr}).xy`;
  }
  
  // vec4 → vec3
  if (fromType === 'vec4' && toType === 'vec3') {
    return `(${expr}).xyz`;
  }
  
  // vec3 → vec4
  if (fromType === 'vec3' && toType === 'vec4') {
    return `vec4(${expr}, 1.0)`;
  }
  
  // Default: no conversion
  return expr;
}
