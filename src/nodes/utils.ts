import type { ShaderNodeDefinition } from '../core/types';

// --- SPLIT NODES ---
export const SplitVec2Node: ShaderNodeDefinition = {
  id: 'split_vec2', label: 'Split (Vec2)',
  inputs: [{ id: 'in', label: 'Vec2', type: 'vec2' }],
  outputs: [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }],
  glslTemplate: ({ in: val }) => `${val || 'vec2(0.0)'}`
};

export const SplitVec3Node: ShaderNodeDefinition = {
  id: 'split_vec3', label: 'Split (Vec3)',
  inputs: [{ id: 'in', label: 'Vec3', type: 'vec3' }],
  outputs: [{ id: 'x', label: 'R', type: 'float' }, { id: 'y', label: 'G', type: 'float' }, { id: 'z', label: 'B', type: 'float' }],
  glslTemplate: ({ in: val }) => `${val || 'vec3(0.0)'}`
};

export const SplitVec4Node: ShaderNodeDefinition = {
  id: 'split_vec4', label: 'Split (Vec4)',
  inputs: [{ id: 'in', label: 'Vec4', type: 'vec4' }], // FIX: Typ wejścia vec4
  outputs: [
    { id: 'x', label: 'R', type: 'float' }, { id: 'y', label: 'G', type: 'float' }, 
    { id: 'z', label: 'B', type: 'float' }, { id: 'w', label: 'A', type: 'float' }
  ],
  glslTemplate: ({ in: val }) => `${val || 'vec4(0.0)'}`
};

// --- COMBINE NODES ---

export const CombineVec2Node: ShaderNodeDefinition = {
  id: 'combine_vec2', label: 'Combine (Vec2)',
  inputs: [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }],
  outputs: [{ id: 'out', label: 'Vec2', type: 'vec2' }],
  glslTemplate: ({ x, y }) => `vec2(${x || '0.0'}, ${y || '0.0'})`
};

export const CombineVec3Node: ShaderNodeDefinition = {
  id: 'combine_vec3', label: 'Combine (Vec3)',
  inputs: [{ id: 'x', label: 'R', type: 'float' }, { id: 'y', label: 'G', type: 'float' }, { id: 'z', label: 'B', type: 'float' }],
  outputs: [{ id: 'out', label: 'Vec3', type: 'vec3' }],
  glslTemplate: ({ x, y, z }) => `vec3(${x || '0.0'}, ${y || '0.0'}, ${z || '0.0'})`
};

export const CombineVec4Node: ShaderNodeDefinition = {
  id: 'combine_vec4', label: 'Combine (Vec4)',
  inputs: [
    { id: 'x', label: 'R', type: 'float' }, { id: 'y', label: 'G', type: 'float' },
    { id: 'z', label: 'B', type: 'float' }, { id: 'w', label: 'A', type: 'float' }
  ],
  outputs: [{ id: 'out', label: 'Vec4', type: 'vec4' }], // FIX: Zmieniono z vec3 na vec4 (RÓŻOWY PIN!)
  glslTemplate: ({ x, y, z, w }) => `vec4(${x || '0.0'}, ${y || '0.0'}, ${z || '0.0'}, ${w || '1.0'})`
};  

// --- RELAY (Auto-adapting) ---
export const RelayAutoNode: ShaderNodeDefinition = {
  id: 'relay_auto', label: 'Relay (Auto)', compact: true,
  inputs: [{ id: 'in', label: 'Auto', type: 'auto' }],
  outputs: [{ id: 'out', label: 'Auto', type: 'auto' }],
  glslTemplate: ({ in: val }) => `${val || '0.0'}`,
  description: 'Passthrough relay that adapts to any input type'
};

export const RelayFloatNode: ShaderNodeDefinition = {
  id: 'relay_float', label: 'Relay (Float)', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `${val || '0.0'}`
};

export const RelayVec3Node: ShaderNodeDefinition = {
  id: 'relay_vec3', label: 'Relay (Vec3)', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'vec3' }],
  outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
  glslTemplate: ({ in: val }) => `${val || 'vec3(0.0)'}`
};

// --- MATH UTILS ---
export const MixNode: ShaderNodeDefinition = {
  id: 'math_mix', label: 'Mix (Lerp)', compact: true,
  inputs: [
    { id: 'a', label: 'A', type: 'vec3' }, { id: 'b', label: 'B', type: 'vec3' }, { id: 't', label: 'T', type: 'float' }
  ],
  outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
  glslTemplate: ({ a, b, t }) => `mix(${a || 'vec3(0.0)'}, ${b || 'vec3(1.0)'}, ${t || '0.5'})`
};

export const NegateNode: ShaderNodeDefinition = {
  id: 'math_negate', label: 'Negate (-x)', compact: true,
  inputs: [{ id: 'in', label: 'In', type: 'float' }],
  outputs: [{ id: 'out', label: 'Out', type: 'float' }],
  glslTemplate: ({ in: val }) => `(-${val || '0.0'})`
};

export const NoteNode: ShaderNodeDefinition = {
  id: 'special_note', label: 'Comment',
  inputs: [], outputs: [],
  controls: { type: 'text', defaultValue: 'Write something here...\nUse scroll for more text.' },
  glslTemplate: () => '' 
};

export const GroupNode: ShaderNodeDefinition = {
  id: 'special_group', label: 'Group Frame',
  inputs: [], outputs: [],
  controls: { type: 'text', defaultValue: 'My Group' },
  glslTemplate: () => '' 
};

export const PreviewNodeDef: ShaderNodeDefinition = {
  id: 'preview',
  label: 'Preview',
  inputs: [{ id: 'in', label: 'In', type: 'vec3' }],
  outputs: [],
  glslTemplate: () => ''
};

export const MonitorNodeDef: ShaderNodeDefinition = {
  id: 'monitor', label: 'Value Watcher',
  inputs: [{ id: 'in', label: 'In', type: 'vec4' }], // Zmieniono na vec4
  outputs: [{ id: 'out', label: 'Passthrough', type: 'vec3' }],
  glslTemplate: ({ in: val }) => `${val ? `vec3(${val})` : 'vec3(0.0)'}`, 
  description: 'Displays numeric values of the signal (R, G, B, A).'
};

export const SmartSplitNode: ShaderNodeDefinition = {
  id: 'smart_split', label: 'Split (Auto)',
  inputs: [{ id: 'in', label: 'Auto', type: 'auto' }],
  outputs: [{ id: 'auto', label: 'Auto', type: 'auto' }], // Placeholder - dynamically replaced
  glslTemplate: ({ in: val }) => `${val || 'vec3(0.0)'}`,
  description: 'Automatically adapts outputs based on input type (vec2→XY, vec3→RGB, vec4→RGBA)'
};

export const SmartComposeNode: ShaderNodeDefinition = {
  id: 'smart_compose', 
  label: 'Compose (Auto)',
  compact: false,
  inputs: [
      { id: 'x', label: 'X', type: 'float' },
      { id: 'y', label: 'Y', type: 'float' },
      { id: 'z', label: 'Z', type: 'float' },
      { id: 'w', label: 'W', type: 'float' }
  ],
  outputs: [{ id: 'out', label: 'Vec3', type: 'vec3' }], // Default: vec3
  glslTemplate: (inputs, data) => {
      const outputType = data?.definition?.outputs?.[0]?.type || 'vec3';
      
      const x = inputs.x || '0.0';
      const y = inputs.y || '0.0';
      const z = inputs.z || '0.0';
      const w = inputs.w || '1.0';

      if (outputType === 'vec2') return `vec2(${x}, ${y})`;
      if (outputType === 'vec4') return `vec4(${x}, ${y}, ${z}, ${w})`;
      return `vec3(${x}, ${y}, ${z})`;
  },
  description: 'Combines floats into a vector. Click buttons on node to change output type.'
};