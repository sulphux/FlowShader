import type { CustomNodeDefinition } from './customNodeManager';
import type { GraphNode, GraphEdge } from './compiler';
import { shaderDebug } from './shaderDebug';

/**
 * Generate GLSL function declaration for custom node
 */
/** GLSL identifiers can't contain hyphens or other punctuation. */
export const sanitizeGLSLIdentifier = (id: string): string => id.replace(/[^a-zA-Z0-9_]/g, '_');

/** Semantic graph types mapped to their concrete GLSL representation. */
export const toGLSLType = (type: string): string => {
  if (!type || type === 'auto') return 'vec3';
  if (type === 'impulse') return 'float';
  return type;
};

/**
 * Name of the generated GLSL function for one output port of a custom node.
 * The FIRST output keeps the bare custom node id (the historical name);
 * additional outputs get a __<portId> suffix — a GLSL function returns one
 * value, so a multi-output custom node compiles to one function per port.
 */
export const customNodeFunctionName = (
  customDef: CustomNodeDefinition,
  outputPort?: { id: string }
): string => {
  if (!outputPort || customDef.outputs[0]?.id === outputPort.id) return customDef.id;
  // GLSL ES reserves identifiers containing "__" — collapse any run of
  // underscores from the id/port concatenation down to one.
  return `${customDef.id}_o_${sanitizeGLSLIdentifier(outputPort.id)}`.replace(/_+/g, '_');
};

export function generateCustomNodeFunction(
  customDef: CustomNodeDefinition,
  compileSubgraphBody: (nodes: GraphNode[], edges: GraphEdge[], targetNodeId: string) => string,
  outputPort?: { id: string; type: string }
): string {
  // Use the outer node's declared ports as the ONE source of truth for the function signature.
  // Re-deriving from the subgraph here would diverge from customDef.inputs if they were set
  // via a different code path (e.g. handleCreateCustomNode on empty selection).
  const inputs = customDef.inputs;
  const outputs = customDef.outputs;
  const port = outputPort ?? outputs[0];

  shaderDebug.log('compiler', 'Generating custom node function', {
    nodeId: customDef.id,
    port: port ? { id: port.id, type: port.type } : undefined,
    inputs: inputs.map(i => ({ id: i.id, type: i.type })),
    outputs: outputs.map(o => ({ id: o.id, type: o.type })),
  });

  const funcName = customNodeFunctionName(customDef, port);
  const returnType = toGLSLType(port?.type ?? '');

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

  // Compile subgraph targeting THIS port's Custom Output node. Port ids from
  // extractCustomNodePorts are the subgraph node ids; legacy defs (e.g. a
  // placeholder 'out' port) fall back to the first Custom Output node.
  const outputNode = customDef.subgraph.nodes.find(n => n.data.definition.id === 'custom_output' && n.id === port?.id)
    || customDef.subgraph.nodes.find(n => n.data.definition.id === 'custom_output');

  if (!outputNode) {
    shaderDebug.error('compiler', 'No Custom Output node found in subgraph', { customNodeId: customDef.id });
    return '';
  }
  
  const body = compileSubgraphBody(subgraphNodes as GraphNode[], customDef.subgraph.edges as GraphEdge[], outputNode.id);

  // Get output variable name
  const outputVar = `var_${outputNode.id.replace(/-/g, '_')}`;

  // The declared return type (from the OUTER node's output port) can disagree
  // with what the body actually produced — e.g. the port stayed 'auto' (→vec3
  // fallback) while a vec2 got wired to Custom Output inside the subgraph.
  // Read the type from the body's own declaration of the output var and cast
  // the return expression to match the signature, otherwise GLSL rejects the
  // function ("return is not matching type").
  const declMatch = body.match(new RegExp(`(float|vec2|vec3|vec4)\\s+${outputVar}\\s*=`));
  const bodyType = declMatch?.[1] ?? returnType;
  const returnExpr = autoCast(outputVar, bodyType, returnType);

  const functionCode = `
${returnType} ${funcName}(${params}) {
${body}    return ${returnExpr};
}
`;
  
  shaderDebug.log('compiler', 'Generated custom node function', {
    customNodeId: customDef.id,
    returnType,
    parameterCount: inputs.length,
    bodyLength: body.length,
    functionLength: functionCode.length,
  });

  return functionCode;
}

/**
 * Auto-cast expression to target type
 */
export function autoCast(expr: string, fromType: string, toType: string): string {
  // 'auto' isn't a real GLSL type. A custom node's input port stays 'auto'
  // when its Custom Input was never wired to anything INSIDE the subgraph
  // (detection only happens there) — but toGLSLType() above still has to put
  // *some* type in the generated function signature, and falls back to vec3.
  // Casts here must agree, or a raw vec2/float gets passed into a vec3
  // parameter and the shader fails to compile ("no matching overloaded
  // function found").
  // Resolve a multi-type target to the exact semantic source type whenever
  // possible (e.g. Frame Buffer Snapshot accepts impulse|float).
  if (toType.includes('|')) {
    const options = toType.split('|');
    toType = options.includes(fromType) ? fromType : options[0];
  }

  // Impulse is distinct at graph-validation time, but it is stored as a
  // scalar in GLSL. Conversion here does not relax connection typing.
  if (fromType === 'impulse') fromType = 'float';
  if (toType === 'impulse') toType = 'float';
  if (toType === 'auto') toType = 'vec3';
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

  // vec2 → vec4
  if (fromType === 'vec2' && toType === 'vec4') {
    return `vec4(${expr}, 0.0, 1.0)`;
  }

  // vec4 → vec2
  if (fromType === 'vec4' && toType === 'vec2') {
    return `(${expr}).xy`;
  }

  // Default: no conversion
  return expr;
}
