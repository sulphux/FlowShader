import type { ShaderNodeDefinition } from '../core/types';

export const SDFCircle: ShaderNodeDefinition = {
  id: 'sdf_circle',
  label: 'Circle SDF',
  inputs: [
    { id: 'uv', label: 'UV', type: 'vec2' },
    { id: 'radius', label: 'Radius', type: 'float' }
  ],
  outputs: [
    { id: 'out', label: 'Distance', type: 'float' }
  ],
  
  glslTemplate: (vars) => {
    const uv = vars.uv || 'uv'; 
    const radius = vars.radius || '0.5';
    return `length(${uv}) - ${radius}`;
  }
};