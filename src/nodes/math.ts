import type { ShaderNodeDefinition } from '../core/types';

// --- Operacje Podstawowe (Float) ---
export const AddNode: ShaderNodeDefinition = {
  id: 'math_add', label: '+', compact: true, description: 'Adds two numbers (A + B)',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Sum', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '0.0'} + ${b || '0.0'})`
};

export const SubNode: ShaderNodeDefinition = {
  id: 'math_sub', label: '-', compact: true, description: 'Subtracts B from A',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Sub', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '0.0'} - ${b || '0.0'})`
};

export const MultNode: ShaderNodeDefinition = {
  id: 'math_mult', label: '×', compact: true, description: 'Multiplies two numbers',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Mul', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '1.0'} * ${b || '1.0'})`
};

export const DivNode: ShaderNodeDefinition = {
  id: 'math_div', label: '÷', compact: true, description: 'Divides A by B',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Div', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '1.0'} / ${b || '1.0'})`
};

// --- Funkcje Matematyczne (Float) ---
export const SinNode: ShaderNodeDefinition = {
  id: 'math_sin', label: 'SIN', compact: true, description: 'Returns sine of input',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Sin', type: 'float' }],
  glslTemplate: ({ in: val }) => `sin(${val || '0.0'})`
};

export const CosNode: ShaderNodeDefinition = {
  id: 'math_cos', label: 'COS', compact: true, description: 'Returns cosine of input',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Cos', type: 'float' }],
  glslTemplate: ({ in: val }) => `cos(${val || '0.0'})`
};

export const AbsNode: ShaderNodeDefinition = {
  id: 'math_abs', label: 'ABS', compact: true, description: 'Returns absolute value (positive)',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Abs', type: 'float' }],
  glslTemplate: ({ in: val }) => `abs(${val || '0.0'})`
};

export const ExpNode: ShaderNodeDefinition = {
  id: 'math_exp', label: 'EXP', compact: true, description: 'Returns e raised to the power of input',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Exp', type: 'float' }],
  glslTemplate: ({ in: val }) => `exp(${val || '0.0'})`
};

export const TanNode: ShaderNodeDefinition = {
  id: 'math_tan', label: 'TAN', compact: true, description: 'Returns tangent of input',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Tan', type: 'float' }],
  glslTemplate: ({ in: val }) => `tan(${val || '0.0'})`
};

export const CotNode: ShaderNodeDefinition = {
  id: 'math_cot', label: 'COT', compact: true, description: 'Returns cotangent of input (cos/sin)',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Cot', type: 'float' }],
  glslTemplate: ({ in: val }) => {
    const v = val || '1.0';
    return `(cos(${v}) / sin(${v}))`;
  }
};

export const ATanNode: ShaderNodeDefinition = {
  id: 'math_atan', label: 'ATAN', compact: true, description: 'Returns arcus tangent of input',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'ATan', type: 'float' }],
  glslTemplate: ({ in: val }) => `atan(${val || '0.0'})`
};

export const FractFloatNode: ShaderNodeDefinition = {
  id: 'math_fract', label: 'FRACT', compact: true, description: 'Returns fractional part of input (x - floor(x))',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Frc', type: 'float' }],
  glslTemplate: ({ in: val }) => `fract(${val || '0.0'})`
};

export const PowNode: ShaderNodeDefinition = {
  id: 'math_pow', label: 'POW', compact: true, description: 'Returns Base raised to Exp',
  inputs: [{ id: 'base', label: 'Base', type: 'float' }, { id: 'exp', label: 'Exp', type: 'float' }],
  outputs: [{ id: 'out', label: 'Pow', type: 'float' }],
  glslTemplate: ({ base, exp }) => `pow(${base || '0.0'}, ${exp || '1.0'})`
};

// --- Operacje na Kolorach ---
export const ColorAddNode: ShaderNodeDefinition = {
  id: 'color_add', label: 'Add (Color)', compact: true, description: 'Adds two colors together (brightens)',
  inputs: [{ id: 'a', label: 'A', type: 'vec3' }, { id: 'b', label: 'B', type: 'vec3' }],
  outputs: [{ id: 'out', label: 'RGB', type: 'vec3' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec3(0.0)'} + ${b || 'vec3(0.0)'})`
};

export const MonoNode: ShaderNodeDefinition = {
  id: 'mono', label: 'Mono (RGB)', compact: true, description: 'Fills R, G and B with a single value (grayscale)',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'RGB', type: 'vec3' }],
  glslTemplate: ({ in: val }) => `vec3(${val || '0.0'})`
};

export const ColorMultNode: ShaderNodeDefinition = {
  id: 'color_mult', label: 'Scale', compact: true, description: 'Multiplies color by a number (darkens/brightens)',
  inputs: [{ id: 'col', label: 'Col', type: 'vec3' }, { id: 'fac', label: 'F', type: 'float' }],
  outputs: [{ id: 'out', label: 'RGB', type: 'vec3' }],
  glslTemplate: ({ col, fac }) => `(${col || 'vec3(1.0)'} * ${fac || '1.0'})`
};