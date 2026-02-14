import type { ShaderNodeDefinition } from '../core/types';

export const OutputNode: ShaderNodeDefinition = {
  id: 'output',
  label: 'Output (Screen)',
  inputs: [
    { id: 'color', label: 'Color', type: 'float|vec3' } // Multi-type: accepts float OR vec3
  ],
  outputs: [], 
  
  glslTemplate: (vars) => {
    if (!vars.color) return 'vec3(0.0)';
    return `vec3(${vars.color})`; 
  }
};