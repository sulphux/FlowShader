import type{ ShaderNodeDefinition } from '../core/types';

export const SinNode: ShaderNodeDefinition = {
  id: 'math_sin',
  label: 'Sine',
  inputs: [
    { id: 'in', label: 'Input', type: 'float' }
  ],
  outputs: [
    { id: 'out', label: 'Sin(x)', type: 'float' }
  ],
  
  glslTemplate: (vars) => {
    const x = vars.in || '0.0';
    // Sinus zwraca -1 do 1. Czasem chcemy 0 do 1, stąd trick z *0.5+0.5,
    // ale na razie zróbmy czysty sinus.
    return `sin(${x})`;
  }
};

export const AbsNode: ShaderNodeDefinition = {
  id: 'math_abs',
  label: 'Abs (Absolute)',
  inputs: [
    { id: 'in', label: 'Input', type: 'float' }
  ],
  outputs: [
    { id: 'out', label: 'Abs(x)', type: 'float' }
  ],
  
  glslTemplate: (vars) => {
    return `abs(${vars.in || '0.0'})`;
  }
};