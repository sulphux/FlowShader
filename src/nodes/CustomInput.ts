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
  glslTemplate: (_, data) => {
    // Return a type-appropriate placeholder for live preview inside the subgraph.
    // When compiled as a function parameter the compiler overrides this via externalInput.
    // Fall back to the definition's saved output port type: serializeGraph
    // historically dropped data.detectedType while KEEPING the adapted port
    // type in the definition — after a reload the compiler declared the var
    // with the port type (e.g. float) while this template, seeing no
    // detectedType, emitted vec3(0.5). "cannot convert vec3 to float".
    const d = data as Record<string, unknown> | undefined;
    const defType = (d?.definition as ShaderNodeDefinition | undefined)?.outputs?.[0]?.type;
    const t = (d?.forcedType || d?.detectedType || defType) as string | undefined;
    if (t === 'float') return '0.0';
    if (t === 'vec2')  return 'vec2(0.5)';
    if (t === 'vec4')  return 'vec4(0.5, 0.5, 0.5, 1.0)';
    return 'vec3(0.5)'; // default / 'auto' / 'vec3'
  },
  description: 'Defines an input port for a custom node. Name this to set the port label.'
};
