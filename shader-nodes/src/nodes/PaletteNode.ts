import type { ShaderNodeDefinition } from '../core/types';

export const PaletteNode: ShaderNodeDefinition = {
  id: 'palette',
  label: 'Cosine Palette',
  inputs: [
    { id: 't', label: 't (Input)', type: 'float' }
    // Opcjonalnie można dodać a,b,c,d jako inputs, ale tu hardcodujemy dla stylu kishimisu
  ],
  outputs: [
    { id: 'color', label: 'Color', type: 'vec3' }
  ],
  glslTemplate: (vars) => {
    const t = vars.t || '0.0';
    // Wartości z tutoriala
    return `(vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(1.0) * ${t} + vec3(0.263, 0.416, 0.557))))`;
  }
};