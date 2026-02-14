import type { ShaderNodeDefinition } from '../core/types';

/**
 * Custom Input Node
 * Used inside custom nodes to define input ports.
 * The control value becomes the port name on the parent custom node.
 */
export const CustomInputNode: ShaderNodeDefinition = {
  id: 'custom_input',
  label: 'Input',
  compact: false,
  inputs: [],
  outputs: [{ id: 'out', type: 'auto', label: 'Value' }],
  controls: {
    type: 'text',
    defaultValue: 'Input'
  },
  glslTemplate: () => 'vec3(0.5)', // Placeholder - will be replaced during compilation
  description: 'Defines an input port for a custom node. Name this to set the port label.'
};
