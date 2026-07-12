import * as THREE from 'three';
import { AUDIO_UNIFORMS, FEEDBACK_UNIFORM, type ShaderRuntimeResources } from './runtimeResources';
import { getAudioLevels } from './audioManager';

/**
 * Bindowanie zasobów runtime (tekstury, audio, feedback) do materiałów THREE.
 * Wspólne dla głównego podglądu, Preview, Monitora i Color Preview.
 */

// Cache tekstur po źródle (data URL) — wiele okien współdzieli jedną teksturę
const textureCache = new Map<string, THREE.Texture>();

// 1x1 czarny placeholder — dla tekstur bez wgranego obrazka i dla feedbacku,
// zanim pierwsza klatka zdąży coś wyrenderować do ping-pong bufora.
let blackTexture: THREE.DataTexture | null = null;
export const getBlackTexture = (): THREE.DataTexture => {
  if (!blackTexture) {
    blackTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackTexture.needsUpdate = true;
  }
  return blackTexture;
};

const getTexture = (src: string): THREE.Texture => {
  if (!src) return getBlackTexture();
  const cached = textureCache.get(src);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(src);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(src, texture);
  return texture;
};

/**
 * Uniformy zasobów do wstawienia przy tworzeniu ShaderMaterial.
 * Zawsze bindujemy coś pod każdy zadeklarowany sampler (placeholder,
 * gdy obrazek nie jest jeszcze wgrany) — inaczej WebGL zgłasza błąd.
 */
export function buildResourceUniforms(resources: ShaderRuntimeResources): Record<string, THREE.IUniform> {
  const uniforms: Record<string, THREE.IUniform> = {};
  resources.textures.forEach(tex => {
    uniforms[tex.uniform] = { value: getTexture(tex.src) };
  });
  if (resources.usesAudio) {
    Object.values(AUDIO_UNIFORMS).forEach(name => {
      uniforms[name] = { value: 0 };
    });
  }
  if (resources.usesFeedback) {
    // Placeholder — the real previous-frame texture is patched in per-frame
    // by updateFeedbackUniform (ShaderPreview owns the ping-pong buffers;
    // Preview/Monitor/Color Preview just read the shared texture read-only).
    uniforms[FEEDBACK_UNIFORM] = { value: getBlackTexture() };
  }
  return uniforms;
}

/** Aktualizacja uniformów audio na materiale — wywoływana co klatkę. */
export function updateAudioUniforms(material: THREE.ShaderMaterial): void {
  const uniforms = material.uniforms;
  if (!uniforms || !uniforms[AUDIO_UNIFORMS.level]) return;
  const levels = getAudioLevels();
  uniforms[AUDIO_UNIFORMS.level].value = levels.level;
  uniforms[AUDIO_UNIFORMS.bass].value = levels.bass;
  uniforms[AUDIO_UNIFORMS.mid].value = levels.mid;
  uniforms[AUDIO_UNIFORMS.high].value = levels.high;
}

/** Aktualizacja tekstury feedbacku na materiale — wywoływana co klatkę. */
export function updateFeedbackUniform(material: THREE.ShaderMaterial, texture: THREE.Texture | null): void {
  const uniforms = material.uniforms;
  if (!uniforms || !uniforms[FEEDBACK_UNIFORM]) return;
  uniforms[FEEDBACK_UNIFORM].value = texture || getBlackTexture();
}

/** Czyszczenie cache (testy / zwolnienie pamięci). */
export function __clearTextureCacheForTests(): void {
  textureCache.forEach(t => t.dispose());
  textureCache.clear();
}
