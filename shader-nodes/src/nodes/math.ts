import type { ShaderNodeDefinition } from '../core/types';

// --- Operacje Podstawowe (Float) ---

export const AddNode: ShaderNodeDefinition = {
  id: 'math_add', label: '+', compact: true,
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '0.0'} + ${b || '0.0'})`
};

export const SubNode: ShaderNodeDefinition = {
  id: 'math_sub', label: '-', compact: true,
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '0.0'} - ${b || '0.0'})`
};

export const MultNode: ShaderNodeDefinition = {
  id: 'math_mult', label: '×', compact: true,
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '1.0'} * ${b || '1.0'})`
};

export const DivNode: ShaderNodeDefinition = {
  id: 'math_div', label: '÷', compact: true,
  inputs: [{ id: 'a', label: 'A', type: 'float' }, { id: 'b', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ a, b }) => `(${a || '1.0'} / ${b || '1.0'})`
};

// --- Funkcje Matematyczne (Float) ---

export const SinNode: ShaderNodeDefinition = {
  id: 'math_sin', label: 'SIN', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `sin(${val || '0.0'})`
};

export const CosNode: ShaderNodeDefinition = {
  id: 'math_cos', label: 'COS', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `cos(${val || '0.0'})`
};

export const AbsNode: ShaderNodeDefinition = {
  id: 'math_abs', label: 'ABS', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `abs(${val || '0.0'})`
};

export const ExpNode: ShaderNodeDefinition = {
  id: 'math_exp', label: 'EXP', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `exp(${val || '0.0'})`
};

export const PowNode: ShaderNodeDefinition = {
  id: 'math_pow', label: 'POW', compact: true,
  inputs: [{ id: 'base', label: 'Base', type: 'float' }, { id: 'exp', label: 'Exp', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ base, exp }) => `pow(${base || '0.0'}, ${exp || '1.0'})`
};

// --- Operacje na Kolorach ---
// Te zostawiamy duże, albo też zmniejszamy, jak wolisz. Tutaj przykład zmniejszenia Add.

export const ColorAddNode: ShaderNodeDefinition = {
  id: 'color_add', label: 'Add (Color)', compact: true,
  inputs: [{ id: 'a', label: 'A', type: 'vec3' }, { id: 'b', label: 'B', type: 'vec3' }],
  outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec3(0.0)'} + ${b || 'vec3(0.0)'})`
};

export const ColorMultNode: ShaderNodeDefinition = {
  id: 'color_mult', label: 'Scale', compact: true,
  inputs: [{ id: 'col', label: 'Col', type: 'vec3' }, { id: 'fac', label: 'F', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
  glslTemplate: ({ col, fac }) => `(${col || 'vec3(1.0)'} * ${fac || '1.0'})`
};