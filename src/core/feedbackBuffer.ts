import type * as THREE from 'three';

/**
 * Holds the main preview's most-recently-completed frame texture, so debug
 * taps (Monitor, Color Preview, Preview nodes) can read live simulation
 * state (e.g. Game of Life) with about one frame of lag, without each
 * owning its own diverging ping-pong buffer. Only ShaderPreview's
 * isMainOutput instance writes to this; everything else only reads it.
 */
export const sharedFeedbackTexture: { current: THREE.Texture | null } = { current: null };
