import type { ShaderNodeDefinition } from '../core/types';

export const TimeNode: ShaderNodeDefinition = {
  id: 'time',
  label: 'Time (iTime)',
  compact: true,
  inputs: [],
  outputs: [
    { id: 't', label: 'Seconds', type: 'float' }
  ],
  
  glslTemplate: () => {
    return `iTime`; // To jest zmienna globalna dostępna w naszym ShaderPreview
  }
};