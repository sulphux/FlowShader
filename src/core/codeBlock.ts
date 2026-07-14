import type { ShaderNodeDefinition } from './types';
import { sanitizeGLSLIdentifier, toGLSLType } from './functionGenerator';

export const CODE_BLOCK_TYPES = ['float', 'vec2', 'vec3', 'vec4'] as const;

// Names that already mean something in GLSL must never be silently replaced
// with calls to another Code Block. A block may still use these words inside
// its body; it simply needs a different title before it becomes callable.
const GLSL_BUILTIN_FUNCTIONS = new Set([
  'abs', 'acos', 'asin', 'atan', 'ceil', 'clamp', 'cos', 'cross', 'degrees',
  'distance', 'dot', 'exp', 'exp2', 'faceforward', 'floor', 'fract',
  'inversesqrt', 'length', 'log', 'log2', 'main', 'mainimage', 'max', 'min',
  'mix', 'mod', 'normalize', 'pow', 'radians', 'reflect', 'refract', 'round',
  'sign', 'sin', 'smoothstep', 'sqrt', 'step', 'tan', 'texture', 'texture2d',
]);

const GLSL_RESERVED_WORDS = new Set([
  'attribute', 'bool', 'break', 'const', 'continue', 'discard', 'do', 'else',
  'false', 'float', 'for', 'if', 'in', 'inout', 'int', 'mat2', 'mat3', 'mat4',
  'out', 'precision', 'return', 'sampler2D', 'struct', 'true', 'uniform',
  'varying', 'vec2', 'vec3', 'vec4', 'void', 'while',
]);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sanitizeCodePortId = (value: string, fallback = 'value'): string => {
  const sanitized = sanitizeGLSLIdentifier(value.trim()).replace(/^([0-9])/, '_$1');
  const identifier = sanitized || fallback;
  return GLSL_RESERVED_WORDS.has(identifier) ? `_${identifier}` : identifier;
};

/** The visible node title doubles as its function name inside other blocks. */
export const codeBlockCallableName = (label: string): string =>
  sanitizeCodePortId(label.trim().toLowerCase(), 'block').replace(/_+/g, '_');

export const isCodeBlockCallableNameAvailable = (name: string): boolean =>
  !GLSL_BUILTIN_FUNCTIONS.has(name) && !GLSL_RESERVED_WORDS.has(name);

export const formatCodeBlockSignature = (label: string, definition: ShaderNodeDefinition): string => {
  const name = codeBlockCallableName(label);
  const inputs = definition.inputs
    .map(port => `${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);

  if (definition.outputs.length <= 1) {
    return `${toGLSLType(definition.outputs[0]?.type || 'float')} ${name}(${inputs.join(', ')})`;
  }

  const outputs = definition.outputs
    .map(port => `out ${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);
  return `void ${name}(${[...inputs, ...outputs].join(', ')})`;
};

export const codeBlockFunctionName = (nodeId: string): string =>
  `code_block_${sanitizeGLSLIdentifier(nodeId)}`.replace(/_+/g, '_');

export const defaultGLSLValue = (type: string): string =>
  type === 'float' ? '0.0' : `${toGLSLType(type)}(0.0)`;

export function buildCodeBlockFunction(
  nodeId: string,
  definition: ShaderNodeDefinition,
  body: string,
): string {
  const inputs = definition.inputs.map(port => `${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);
  const outputs = definition.outputs;
  const functionName = codeBlockFunctionName(nodeId);
  const safeBody = body.trim();
  const normalizedBody = [...definition.inputs, ...definition.outputs].reduce((source, port) => {
    const safeId = sanitizeCodePortId(port.id);
    return safeId === port.id ? source : source.replace(new RegExp(`\\b${escapeRegExp(port.id)}\\b`, 'g'), safeId);
  }, safeBody);

  if (outputs.length <= 1) {
    const output = outputs[0] ?? { id: 'out', type: 'float' };
    const fallbackBody = `return ${defaultGLSLValue(output.type)};`;
    return `${toGLSLType(output.type)} ${functionName}(${inputs.join(', ')}) {\n${normalizedBody || fallbackBody}\n}`;
  }

  const outputParams = outputs.map(port => `out ${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);
  const fallbackBody = outputs.map(port => `${sanitizeCodePortId(port.id)} = ${defaultGLSLValue(port.type)};`).join('\n');
  return `void ${functionName}(${[...inputs, ...outputParams].join(', ')}) {\n${normalizedBody || fallbackBody}\n}`;
}

export function codeBlockPrototype(nodeId: string, definition: ShaderNodeDefinition): string {
  const inputs = definition.inputs.map(port => `${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);
  if (definition.outputs.length <= 1) {
    return `${toGLSLType(definition.outputs[0]?.type || 'float')} ${codeBlockFunctionName(nodeId)}(${inputs.join(', ')});`;
  }
  const outputs = definition.outputs.map(port => `out ${toGLSLType(port.type)} ${sanitizeCodePortId(port.id)}`);
  return `void ${codeBlockFunctionName(nodeId)}(${[...inputs, ...outputs].join(', ')});`;
}
