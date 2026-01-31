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
    // --- POPRAWKA: Wartości domyślne (fallbacki) ---
    // Jeśli vars.uv nie istnieje (brak kabla), użyj zmiennej 'uv' z kodu głównego
    const uv = vars.uv || 'uv'; 
    // Jeśli radius nie istnieje, użyj 0.5
    const radius = vars.radius || '0.5';

    return `length(${uv}) - ${radius}`;
  }
};