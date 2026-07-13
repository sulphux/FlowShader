import type { GraphNode } from './compiler';

/**
 * Zasoby runtime shadera — tekstury i audio.
 *
 * Nody texture_2d / audio_input generują w GLSL odwołania do uniformów,
 * które musi zbindować każde okno renderujące (główny podgląd, Preview,
 * Monitor, Color Preview). Ten moduł jest jedynym źródłem prawdy dla
 * nazw uniformów i zbierania zasobów z grafu.
 */

export interface TextureResource {
  /** Nazwa uniformu sampler2D w GLSL (np. u_tex_texture_2d_123). */
  uniform: string;
  /** Źródło obrazka — data URL zapisany w data.value noda. */
  src: string;
}

export interface ShaderRuntimeResources {
  textures: TextureResource[];
  usesAudio: boolean;
  /** Graf używa co najmniej jednego noda Feedback. */
  usesFeedback: boolean;
  /** Każdy Feedback ma osobny sampler i osobny bufor stanu. */
  feedbacks?: FeedbackResource[];
}

export interface FeedbackResource {
  nodeId: string;
  uniform: string;
}

/** Uniformy audio wspólne dla całego grafu (jedno źródło dźwięku). */
export const AUDIO_UNIFORMS = {
  level: 'u_audio_level',
  bass: 'u_audio_bass',
  mid: 'u_audio_mid',
  high: 'u_audio_high',
} as const;

/** Legacy fallback used only by old callers constructing resources by hand. */
export const FEEDBACK_UNIFORM = 'u_feedback';

/** GLSL identifier nie może zawierać myślników ani kropek. */
const sanitizeId = (nodeId: string): string => nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

export const feedbackUniformName = (nodeId: string): string => {
  const safe = sanitizeId(nodeId).replace(/_+/g, '_').replace(/^_+/, '') || 'node';
  return `u_feedback_${safe}`;
};

export const textureUniformName = (nodeId: string): string => `u_tex_${sanitizeId(nodeId)}`;

export const isTextureNode = (node: GraphNode): boolean =>
  node.data?.definition?.id === 'texture_2d';

export const isAudioNode = (node: GraphNode): boolean =>
  node.data?.definition?.id === 'audio_input';

export const isFeedbackNode = (node: GraphNode): boolean =>
  node.data?.definition?.id === 'feedback';

/**
 * Zbiera zasoby (tekstury + flaga audio/feedback) z listy nodów grafu.
 * Tekstury bez wgranego obrazka są pomijane (shader dostanie czarny sampler
 * z domyślnej pustej tekstury bindowanej przez preview).
 */
export function collectRuntimeResources(nodes: GraphNode[]): ShaderRuntimeResources {
  const textures: TextureResource[] = [];
  let usesAudio = false;
  let usesFeedback = false;
  const feedbacks: FeedbackResource[] = [];

  nodes.forEach(node => {
    if (isTextureNode(node)) {
      const src = typeof node.data?.value === 'string' ? node.data.value : '';
      textures.push({ uniform: textureUniformName(node.id), src });
    }
    if (isAudioNode(node)) {
      usesAudio = true;
    }
    if (isFeedbackNode(node)) {
      usesFeedback = true;
      feedbacks.push({ nodeId: node.id, uniform: feedbackUniformName(node.id) });
    }
  });

  return { textures, usesAudio, usesFeedback, feedbacks };
}

export function feedbackUniforms(resources: ShaderRuntimeResources): string[] {
  if (resources.feedbacks?.length) return resources.feedbacks.map(feedback => feedback.uniform);
  return resources.usesFeedback ? [FEEDBACK_UNIFORM] : [];
}

/** Deklaracje uniformów do wstrzyknięcia w nagłówek shadera. */
export function buildUniformDeclarations(resources: ShaderRuntimeResources): string {
  const lines: string[] = [];
  resources.textures.forEach(tex => {
    lines.push(`    uniform sampler2D ${tex.uniform};`);
  });
  if (resources.usesAudio) {
    Object.values(AUDIO_UNIFORMS).forEach(name => {
      lines.push(`    uniform float ${name};`);
    });
  }
  feedbackUniforms(resources).forEach(name => lines.push(`    uniform sampler2D ${name};`));
  return lines.join('\n');
}
