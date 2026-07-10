import type { ShaderNodeDefinition } from '../core/types';
import { textureUniformName, AUDIO_UNIFORMS } from '../core/runtimeResources';

/**
 * Nody mediów: tekstura (obraz z dysku) i audio (dźwięk z dysku).
 * Uniformy deklaruje kompilator (buildUniformDeclarations), a bindują
 * okna renderujące na podstawie collectRuntimeResources().
 */

export const TextureNode: ShaderNodeDefinition = {
  id: 'texture_2d',
  label: 'Texture',
  inputs: [{ id: 'uv', label: 'UV', type: 'vec2' }],
  outputs: [{ id: 'rgb', label: 'RGB', type: 'vec3' }],
  glslTemplate: (inputs, data) => {
    const nodeId = typeof data?.nodeId === 'string' ? data.nodeId : 'unknown';
    const uniform = textureUniformName(nodeId);
    // uv w main() jest w zakresie ~[-1,1] (aspect-corrected); tekstury próbkujemy w [0,1]
    const coords = inputs.uv || '(uv * 0.5 + 0.5)';
    return `texture2D(${uniform}, ${coords}).rgb`;
  },
  description: 'Samples an uploaded image. Optional UV input (defaults to screen UV).'
};

export const AudioInputNode: ShaderNodeDefinition = {
  id: 'audio_input',
  label: 'Audio',
  // Zmienna vec4, wyjścia czytane swizzlem: x=level, y=bass, z=mid, w=high
  varType: 'vec4',
  inputs: [],
  outputs: [
    { id: 'x', label: 'Level', type: 'float' },
    { id: 'y', label: 'Bass', type: 'float' },
    { id: 'z', label: 'Mid', type: 'float' },
    { id: 'w', label: 'High', type: 'float' }
  ],
  glslTemplate: () =>
    `vec4(${AUDIO_UNIFORMS.level}, ${AUDIO_UNIFORMS.bass}, ${AUDIO_UNIFORMS.mid}, ${AUDIO_UNIFORMS.high})`,
  description: 'Live levels of an uploaded audio file: overall level, bass, mid, high (0..1).'
};
