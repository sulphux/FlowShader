import type { ShaderNodeDefinition } from '../core/types';

const formatFloat = (n: unknown) => {
  const num = parseFloat(String(n));
  if (isNaN(num)) return '0.0';
  return Number.isInteger(num) ? `${num}.0` : `${num}`;
};

// Formatowanie koloru hex (#ff0000) na vec3(1.0, 0.0, 0.0)
const hexToVec3 = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `vec3(${formatFloat(r)}, ${formatFloat(g)}, ${formatFloat(b)})`;
};

export const FloatNode: ShaderNodeDefinition = {
  id: 'param_float',
  label: 'Float Param',
  inputs: [],
  outputs: [{ id: 'out', label: 'Val', type: 'float' }],
  controls: {
    type: 'float',
    defaultValue: 0.5,
    min: 0.0,
    max: 10.0,
    step: 0.01
  },
  // Bierzemy wartość z data.value
  glslTemplate: (_, data) => formatFloat(data?.value ?? 0.5)
};

export const ColorNode: ShaderNodeDefinition = {
  id: 'param_color',
  label: 'Color Param',
  inputs: [],
  outputs: [{ id: 'rgb', label: 'RGB', type: 'vec3' }],
  controls: {
    type: 'color',
    defaultValue: '#ff007a',
  },
  glslTemplate: (_, data) => hexToVec3(data?.value ?? '#ff007a')
};