import type { ShaderNodeDefinition } from '../core/types';

export const UVNode: ShaderNodeDefinition = {
  id: 'uv', label: 'UV Coord', compact: true,
  inputs: [],
  outputs: [{ id: 'out', type: 'vec2', label: 'UV' }], // Było label: ''
  glslTemplate: () => 'uv'
};

export const LengthNode: ShaderNodeDefinition = {
  id: 'vec_length', label: 'Length (Vec2)', compact: true,
  inputs: [{ id: 'in', type: 'vec2', label: 'Vec' }], // Było label: ''
  outputs: [{ id: 'out', type: 'float', label: 'Len' }],
  glslTemplate: ({ in: val }) => `length(${val || 'vec2(0.0)'})`
};

export const LengthVec3Node: ShaderNodeDefinition = {
  id: 'vec_length3', label: 'Length (Vec3)', compact: true,
  description: 'Returns the magnitude of a Vec3.',
  inputs: [{ id: 'in', type: 'vec3', label: 'Vec3' }],
  outputs: [{ id: 'out', type: 'float', label: 'Len' }],
  glslTemplate: ({ in: val }) => `length(${val || 'vec3(0.0)'})`
};

export const NormalizeVec3Node: ShaderNodeDefinition = {
  id: 'vec_normalize3', label: 'Normalize (Vec3)', compact: true,
  description: 'Returns a Vec3 with length 1. The disconnected default points along +Z.',
  inputs: [{ id: 'in', type: 'vec3', label: 'Vec3' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Unit' }],
  glslTemplate: ({ in: val }) => `normalize(${val || 'vec3(0.0, 0.0, 1.0)'})`
};

export const FractNode: ShaderNodeDefinition = {
  id: 'vec_fract', label: 'Fract (Vec2)', compact: true,
  inputs: [{ id: 'in', type: 'vec2', label: 'In' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Out' }],
  glslTemplate: ({ in: val }) => `fract(${val || 'vec2(0.0)'})`
};

export const UVScaleNode: ShaderNodeDefinition = {
  id: 'uv_scale', label: 'UV Scale (*)', compact: true,
  inputs: [{ id: 'uv', type: 'vec2', label: 'UV' }, { id: 'scale', type: 'float', label: 'Scl' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Out' }],
  glslTemplate: ({ uv, scale }) => `(${uv || 'vec2(0.0)'} * ${scale || '1.0'})`
};

export const UVShiftNode: ShaderNodeDefinition = {
  id: 'uv_shift', label: 'UV Shift (+/-)', compact: true,
  inputs: [{ id: 'uv', type: 'vec2', label: 'UV' }, { id: 'shift', type: 'float', label: 'Off' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Out' }],
  glslTemplate: ({ uv, shift }) => `(${uv || 'vec2(0.0)'} - vec2(${shift || '0.0'}))`
};