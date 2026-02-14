import type { ShaderNodeDefinition } from '../core/types';

export const OutputNode: ShaderNodeDefinition = {
  id: 'output',
  label: 'Output (Screen)',
  inputs: [
    { id: 'color', label: 'Color (vec3/float)', type: 'vec3' }
  ],
  outputs: [], 
  
  glslTemplate: (vars) => {
    // Jeśli nic nie podpięte, zwróć czarny
    if (!vars.color) return 'vec3(0.0)';
    
    // Trick: Konstruktor vec3(float) w GLSL robi grayscale, 
    // więc to zadziała zarówno dla koloru jak i dla samej liczby (np. z kółka)
    return `vec3(${vars.color})`; 
  }
};