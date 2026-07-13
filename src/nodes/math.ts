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

export const FloorNode: ShaderNodeDefinition = {
  id: 'math_floor', label: 'FLOOR', compact: true,
  description: 'Rounds down to the nearest integer.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Floor', type: 'float' }],
  glslTemplate: ({ in: val }) => `floor(${val || '0.0'})`
};

export const CeilNode: ShaderNodeDefinition = {
  id: 'math_ceil', label: 'CEIL', compact: true,
  description: 'Rounds up to the nearest integer.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Ceil', type: 'float' }],
  glslTemplate: ({ in: val }) => `ceil(${val || '0.0'})`
};

export const RoundNode: ShaderNodeDefinition = {
  id: 'math_round', label: 'ROUND', compact: true,
  description: 'Rounds to the nearest integer using a GLSL ES 1.00-compatible expression.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Round', type: 'float' }],
  glslTemplate: ({ in: val }) => {
    const x = val || '0.0';
    return `(sign(${x}) * floor(abs(${x}) + 0.5))`;
  }
};

export const SignNode: ShaderNodeDefinition = {
  id: 'math_sign', label: 'SIGN', compact: true,
  description: 'Returns -1, 0, or 1 according to the sign of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Sign', type: 'float' }],
  glslTemplate: ({ in: val }) => `sign(${val || '0.0'})`
};

export const SqrtNode: ShaderNodeDefinition = {
  id: 'math_sqrt', label: 'SQRT', compact: true,
  description: 'Returns the square root of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Sqrt', type: 'float' }],
  glslTemplate: ({ in: val }) => `sqrt(${val || '0.0'})`
};

export const InverseSqrtNode: ShaderNodeDefinition = {
  id: 'math_inversesqrt', label: 'INVERSE SQRT', compact: true,
  description: 'Returns one divided by the square root of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Inv Sqrt', type: 'float' }],
  glslTemplate: ({ in: val }) => `inversesqrt(${val || '1.0'})`
};

export const ModNode: ShaderNodeDefinition = {
  id: 'math_mod', label: 'MOD', compact: true,
  description: 'Returns X modulo Y using GLSL mod semantics.',
  inputs: [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }],
  outputs: [{ id: 'out', label: 'Mod', type: 'float' }],
  glslTemplate: ({ x, y }) => `mod(${x || '0.0'}, ${y || '1.0'})`
};

export const ASinNode: ShaderNodeDefinition = {
  id: 'math_asin', label: 'ASIN', compact: true,
  description: 'Returns the arc sine of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'ASin', type: 'float' }],
  glslTemplate: ({ in: val }) => `asin(${val || '0.0'})`
};

export const ACosNode: ShaderNodeDefinition = {
  id: 'math_acos', label: 'ACOS', compact: true,
  description: 'Returns the arc cosine of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'ACos', type: 'float' }],
  glslTemplate: ({ in: val }) => `acos(${val || '0.0'})`
};

export const ATan2Node: ShaderNodeDefinition = {
  id: 'math_atan2', label: 'ATAN2', compact: true,
  description: 'Returns the signed angle of the vector (X, Y).',
  inputs: [{ id: 'y', label: 'Y', type: 'float' }, { id: 'x', label: 'X', type: 'float' }],
  outputs: [{ id: 'out', label: 'Angle', type: 'float' }],
  glslTemplate: ({ y, x }) => `atan(${y || '0.0'}, ${x || '1.0'})`
};

export const LogNode: ShaderNodeDefinition = {
  id: 'math_log', label: 'LOG', compact: true,
  description: 'Returns the natural logarithm of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Log', type: 'float' }],
  glslTemplate: ({ in: val }) => `log(${val || '1.0'})`
};

export const Log2Node: ShaderNodeDefinition = {
  id: 'math_log2', label: 'LOG2', compact: true,
  description: 'Returns the base-2 logarithm of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Log2', type: 'float' }],
  glslTemplate: ({ in: val }) => `log2(${val || '1.0'})`
};

export const Exp2Node: ShaderNodeDefinition = {
  id: 'math_exp2', label: 'EXP2', compact: true,
  description: 'Returns two raised to the power of the input.',
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Exp2', type: 'float' }],
  glslTemplate: ({ in: val }) => `exp2(${val || '0.0'})`
};

export const RadiansNode: ShaderNodeDefinition = {
  id: 'math_radians', label: 'RADIANS', compact: true,
  description: 'Converts degrees to radians.',
  inputs: [{ id: 'in', label: 'Degrees', type: 'float' }],
  outputs: [{ id: 'out', label: 'Radians', type: 'float' }],
  glslTemplate: ({ in: val }) => `radians(${val || '0.0'})`
};

export const DegreesNode: ShaderNodeDefinition = {
  id: 'math_degrees', label: 'DEGREES', compact: true,
  description: 'Converts radians to degrees.',
  inputs: [{ id: 'in', label: 'Radians', type: 'float' }],
  outputs: [{ id: 'out', label: 'Degrees', type: 'float' }],
  glslTemplate: ({ in: val }) => `degrees(${val || '0.0'})`
};

export const StepNode: ShaderNodeDefinition = {
  id: 'math_step', label: 'STEP', compact: true,
  description: 'Hard threshold: returns 0 when X < Edge, otherwise 1. Unconnected Edge defaults to 0.5.',
  inputs: [
    { id: 'edge', label: 'Edge', type: 'float' },
    { id: 'x', label: 'X', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Step', type: 'float' }],
  glslTemplate: ({ edge, x }) => `step(${edge || '0.5'}, ${x || '0.0'})`
};

export const SmoothstepNode: ShaderNodeDefinition = {
  id: 'math_smoothstep', label: 'SMOOTHSTEP', compact: true,
  description: 'Returns a smooth Hermite transition between Edge 0 and Edge 1.',
  inputs: [
    { id: 'edge0', label: 'Edge 0', type: 'float' },
    { id: 'edge1', label: 'Edge 1', type: 'float' },
    { id: 'x', label: 'X', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Smooth', type: 'float' }],
  glslTemplate: ({ edge0, edge1, x }) => `smoothstep(${edge0 || '0.0'}, ${edge1 || '1.0'}, ${x || '0.0'})`
};

export const MinNode: ShaderNodeDefinition = {
  id: 'math_min', label: 'MIN', compact: true,
  description: 'Returns the smaller of A and B.',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Min', type: 'float' }],
  glslTemplate: ({ a, b }) => `min(${a || '0.0'}, ${b || '0.0'})`
};

export const MaxNode: ShaderNodeDefinition = {
  id: 'math_max', label: 'MAX', compact: true,
  description: 'Returns the larger of A and B.',
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Max', type: 'float' }],
  glslTemplate: ({ a, b }) => `max(${a || '0.0'}, ${b || '0.0'})`
};

export const ClampNode: ShaderNodeDefinition = {
  id: 'math_clamp', label: 'CLAMP', compact: true,
  description: 'Constrains X to the Min..Max range.',
  inputs: [
    { id: 'x', label: 'X', type: 'float' },
    { id: 'min', label: 'Min', type: 'float' },
    { id: 'max', label: 'Max', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Clamped', type: 'float' }],
  glslTemplate: ({ x, min, max }) => `clamp(${x || '0.0'}, ${min || '0.0'}, ${max || '1.0'})`
};

export const MixFloatNode: ShaderNodeDefinition = {
  id: 'math_mix_float', label: 'MIX (Float)', compact: true,
  description: 'Linearly interpolates from A to B using T.',
  inputs: [
    { id: 'a', label: 'A', type: 'float' },
    { id: 'b', label: 'B', type: 'float' },
    { id: 't', label: 'T', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Mix', type: 'float' }],
  glslTemplate: ({ a, b, t }) => `mix(${a || '0.0'}, ${b || '1.0'}, ${t || '0.5'})`
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
