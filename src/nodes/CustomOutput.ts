import type { ShaderNodeDefinition } from '../core/types';

/**
 * Custom Output Node
 * Used inside custom nodes to define output ports.
 * The control value becomes the port name on the parent custom node.
 */
export const CustomOutputNode: ShaderNodeDefinition = {
  id: 'custom_output',
  label: 'Output',
  compact: false,
  inputs: [{ id: 'in', type: 'auto', label: 'Value' }],
  outputs: [],
  controls: {
    type: 'text',
    defaultValue: 'Output'
  },
  glslTemplate: ({ in: val }) => val || 'vec3(0.0)',
  description: 'Defines an output port for a custom node. Name this to set the port label.'
};
