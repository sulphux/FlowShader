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

export const NormalizeVec2Node: ShaderNodeDefinition = {
  id: 'vec_normalize2', label: 'Normalize (Vec2)', compact: true,
  description: 'Returns a Vec2 with length 1. The disconnected default points along +X.',
  inputs: [{ id: 'in', type: 'vec2', label: 'Vec2' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Unit' }],
  glslTemplate: ({ in: val }) => `normalize(${val || 'vec2(1.0, 0.0)'})`
};

export const DotVec2Node: ShaderNodeDefinition = {
  id: 'vec_dot2', label: 'Dot (Vec2)', compact: true,
  inputs: [{ id: 'a', type: 'vec2', label: 'A' }, { id: 'b', type: 'vec2', label: 'B' }],
  outputs: [{ id: 'out', type: 'float', label: 'Dot' }],
  glslTemplate: ({ a, b }) => `dot(${a || 'vec2(0.0)'}, ${b || 'vec2(0.0)'})`
};

export const DotVec3Node: ShaderNodeDefinition = {
  id: 'vec_dot3', label: 'Dot (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'float', label: 'Dot' }],
  glslTemplate: ({ a, b }) => `dot(${a || 'vec3(0.0)'}, ${b || 'vec3(0.0)'})`
};

export const DistanceVec2Node: ShaderNodeDefinition = {
  id: 'vec_distance2', label: 'Distance (Vec2)', compact: true,
  inputs: [{ id: 'a', type: 'vec2', label: 'A' }, { id: 'b', type: 'vec2', label: 'B' }],
  outputs: [{ id: 'out', type: 'float', label: 'Distance' }],
  glslTemplate: ({ a, b }) => `distance(${a || 'vec2(0.0)'}, ${b || 'vec2(0.0)'})`
};

export const DistanceVec3Node: ShaderNodeDefinition = {
  id: 'vec_distance3', label: 'Distance (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'float', label: 'Distance' }],
  glslTemplate: ({ a, b }) => `distance(${a || 'vec3(0.0)'}, ${b || 'vec3(0.0)'})`
};

export const CrossVec3Node: ShaderNodeDefinition = {
  id: 'vec_cross3', label: 'Cross (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Cross' }],
  glslTemplate: ({ a, b }) => `cross(${a || 'vec3(1.0, 0.0, 0.0)'}, ${b || 'vec3(0.0, 1.0, 0.0)'})`
};

export const ReflectVec3Node: ShaderNodeDefinition = {
  id: 'vec_reflect3', label: 'Reflect (Vec3)', compact: true,
  inputs: [{ id: 'incident', type: 'vec3', label: 'Incident' }, { id: 'normal', type: 'vec3', label: 'Normal' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Reflected' }],
  glslTemplate: ({ incident, normal }) => `reflect(${incident || 'vec3(0.0, 0.0, -1.0)'}, ${normal || 'vec3(0.0, 0.0, 1.0)'})`
};

export const RefractVec3Node: ShaderNodeDefinition = {
  id: 'vec_refract3', label: 'Refract (Vec3)', compact: true,
  inputs: [
    { id: 'incident', type: 'vec3', label: 'Incident' },
    { id: 'normal', type: 'vec3', label: 'Normal' },
    { id: 'eta', type: 'float', label: 'Eta' },
  ],
  outputs: [{ id: 'out', type: 'vec3', label: 'Refracted' }],
  glslTemplate: ({ incident, normal, eta }) => `refract(${incident || 'vec3(0.0, 0.0, -1.0)'}, ${normal || 'vec3(0.0, 0.0, 1.0)'}, ${eta || '1.0'})`
};

export const FaceForwardVec3Node: ShaderNodeDefinition = {
  id: 'vec_faceforward3', label: 'Face Forward (Vec3)', compact: true,
  inputs: [
    { id: 'normal', type: 'vec3', label: 'Normal' },
    { id: 'incident', type: 'vec3', label: 'Incident' },
    { id: 'reference', type: 'vec3', label: 'Reference' },
  ],
  outputs: [{ id: 'out', type: 'vec3', label: 'Facing Normal' }],
  glslTemplate: ({ normal, incident, reference }) => `faceforward(${normal || 'vec3(0.0, 0.0, 1.0)'}, ${incident || 'vec3(0.0, 0.0, -1.0)'}, ${reference || 'vec3(0.0, 0.0, 1.0)'})`
};

export const AddVec2Node: ShaderNodeDefinition = {
  id: 'vec_add2', label: 'Add (Vec2)', compact: true,
  inputs: [{ id: 'a', type: 'vec2', label: 'A' }, { id: 'b', type: 'vec2', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Sum' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec2(0.0)'} + ${b || 'vec2(0.0)'})`
};

export const SubVec2Node: ShaderNodeDefinition = {
  id: 'vec_sub2', label: 'Subtract (Vec2)', compact: true,
  inputs: [{ id: 'a', type: 'vec2', label: 'A' }, { id: 'b', type: 'vec2', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Difference' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec2(0.0)'} - ${b || 'vec2(0.0)'})`
};

export const MultiplyVec2Node: ShaderNodeDefinition = {
  id: 'vec_mult2', label: 'Multiply (Vec2)', compact: true,
  inputs: [{ id: 'a', type: 'vec2', label: 'A' }, { id: 'b', type: 'vec2', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Product' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec2(0.0)'} * ${b || 'vec2(1.0)'})`
};

export const ScaleVec2Node: ShaderNodeDefinition = {
  id: 'vec_scale2', label: 'Scale (Vec2)', compact: true,
  inputs: [{ id: 'vector', type: 'vec2', label: 'Vector' }, { id: 'factor', type: 'float', label: 'Factor' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Scaled' }],
  glslTemplate: ({ vector, factor }) => `(${vector || 'vec2(0.0)'} * ${factor || '1.0'})`
};

export const DivideVec2Node: ShaderNodeDefinition = {
  id: 'vec_div2', label: 'Divide (Vec2)', compact: true,
  inputs: [{ id: 'vector', type: 'vec2', label: 'Vector' }, { id: 'divisor', type: 'float', label: 'Divisor' }],
  outputs: [{ id: 'out', type: 'vec2', label: 'Quotient' }],
  glslTemplate: ({ vector, divisor }) => `(${vector || 'vec2(0.0)'} / ${divisor || '1.0'})`
};

export const AddVec3Node: ShaderNodeDefinition = {
  id: 'vec_add3', label: 'Add (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Sum' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec3(0.0)'} + ${b || 'vec3(0.0)'})`
};

export const SubVec3Node: ShaderNodeDefinition = {
  id: 'vec_sub3', label: 'Subtract (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Difference' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec3(0.0)'} - ${b || 'vec3(0.0)'})`
};

export const MultiplyVec3Node: ShaderNodeDefinition = {
  id: 'vec_mult3', label: 'Multiply (Vec3)', compact: true,
  inputs: [{ id: 'a', type: 'vec3', label: 'A' }, { id: 'b', type: 'vec3', label: 'B' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Product' }],
  glslTemplate: ({ a, b }) => `(${a || 'vec3(0.0)'} * ${b || 'vec3(1.0)'})`
};

export const ScaleVec3Node: ShaderNodeDefinition = {
  id: 'vec_scale3', label: 'Scale (Vec3)', compact: true,
  inputs: [{ id: 'vector', type: 'vec3', label: 'Vector' }, { id: 'factor', type: 'float', label: 'Factor' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Scaled' }],
  glslTemplate: ({ vector, factor }) => `(${vector || 'vec3(0.0)'} * ${factor || '1.0'})`
};

export const DivideVec3Node: ShaderNodeDefinition = {
  id: 'vec_div3', label: 'Divide (Vec3)', compact: true,
  inputs: [{ id: 'vector', type: 'vec3', label: 'Vector' }, { id: 'divisor', type: 'float', label: 'Divisor' }],
  outputs: [{ id: 'out', type: 'vec3', label: 'Quotient' }],
  glslTemplate: ({ vector, divisor }) => `(${vector || 'vec3(0.0)'} / ${divisor || '1.0'})`
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
