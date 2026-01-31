import type { ShaderNodeDefinition } from '../core/types';

export const UVNode: ShaderNodeDefinition = {
  id: 'uv', label: 'UV Coord',
  inputs: [],
  outputs: [{
      id: 'out', type: 'vec2',
      label: ''
  }],
  glslTemplate: () => 'uv' // Nasz kompilator dostarcza zmienną 'uv'
};

export const LengthNode: ShaderNodeDefinition = {
  id: 'vec_length', label: 'Length',
  inputs: [{
      id: 'in', type: 'vec2',
      label: ''
  }], // Długość wektora UV
  outputs: [{
      id: 'out', type: 'float',
      label: ''
  }],
  glslTemplate: ({ in: val }) => `length(${val || 'vec2(0.0)'})`
};

export const FractNode: ShaderNodeDefinition = {
  id: 'vec_fract', label: 'Fract (Vec2)',
  inputs: [{
      id: 'in', type: 'vec2',
      label: ''
  }],
  outputs: [{
      id: 'out', type: 'vec2',
      label: ''
  }],
  glslTemplate: ({ in: val }) => `fract(${val || 'vec2(0.0)'})`
};

// Specjalne operacje dla UV (mnożenie wektora przez liczbę)
export const UVScaleNode: ShaderNodeDefinition = {
  id: 'uv_scale', label: 'UV Scale (*)',
  inputs: [{
      id: 'uv', type: 'vec2',
      label: ''
  }, {
      id: 'scale', type: 'float',
      label: ''
  }],
  outputs: [{
      id: 'out', type: 'vec2',
      label: ''
  }],
  glslTemplate: ({ uv, scale }) => `(${uv || 'vec2(0.0)'} * ${scale || '1.0'})`
};

export const UVShiftNode: ShaderNodeDefinition = {
  id: 'uv_shift', label: 'UV Shift (+/-)',
  inputs: [{
      id: 'uv', type: 'vec2',
      label: ''
  }, {
      id: 'shift', type: 'float',
      label: ''
  }],
  outputs: [{
      id: 'out', type: 'vec2',
      label: ''
  }],
  glslTemplate: ({ uv, shift }) => `(${uv || 'vec2(0.0)'} - ${shift || '0.0'})`
};