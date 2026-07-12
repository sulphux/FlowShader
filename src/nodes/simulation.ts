import type { ShaderNodeDefinition } from '../core/types';
import { FEEDBACK_UNIFORM } from '../core/runtimeResources';

/**
 * Nody symulacji: Feedback (stan z poprzedniej klatki), Impulse (okresowy
 * puls sterujący tym, KIEDY symulacja ma "kroczyć") i Random (szum, opcjonalnie
 * trzymany stały w oknie czasowym). Feedback wymaga silnika renderującego
 * ping-pong bufor (ShaderPreview.tsx, tylko główny podgląd) — Impulse i Random
 * są w pełni bezstanowe (czyste funkcje iTime), nie wymagają zmian w silniku.
 */

export const FeedbackNode: ShaderNodeDefinition = {
  id: 'feedback',
  label: 'Feedback (Prev Frame)',
  inputs: [{ id: 'uv', label: 'UV', type: 'vec2' }],
  outputs: [{ id: 'rgb', label: 'RGB', type: 'vec3' }],
  glslTemplate: (inputs) => {
    const coords = inputs.uv || '(uv * 0.5 + 0.5)';
    return `texture2D(${FEEDBACK_UNIFORM}, ${coords}).rgb`;
  },
  description: 'Samples what was rendered to the screen last frame. Needed to build any simulation with persistent state (e.g. Game of Life). Optional UV input (defaults to screen UV).',
};

export const ImpulseNode: ShaderNodeDefinition = {
  id: 'impulse',
  label: 'Impulse',
  compact: true,
  inputs: [
    { id: 'interval', label: 'Interval (s)', type: 'float' },
    { id: 'width', label: 'Width', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Pulse', type: 'float' }],
  glslTemplate: (inputs) => {
    const interval = inputs.interval || '1.0';
    const width = inputs.width || '0.05';
    return `((mod(iTime, max(${interval}, 0.001)) < (${interval} * ${width})) ? 1.0 : 0.0)`;
  },
  description: 'Emits a brief 1.0 pulse every "Interval" seconds, 0.0 otherwise. Wire into Mix to gate when a simulation step should advance (e.g. mix(Feedback, NewState, Impulse)).',
};

export const RandomNode: ShaderNodeDefinition = {
  id: 'math_random',
  label: 'Random',
  compact: true,
  inputs: [
    { id: 'seed', label: 'Seed', type: 'vec2' },
    { id: 'interval', label: 'Interval (s)', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Value', type: 'float' }],
  glslTemplate: (inputs) => {
    const seed = inputs.seed || 'uv';
    // No interval connected: hash off raw iTime, so the value changes every
    // frame (continuous noise). Interval connected: quantize time first, so
    // the value holds steady within each window and jumps at the boundary.
    const timeKey = inputs.interval ? `floor(iTime / max(${inputs.interval}, 0.001))` : 'iTime';
    return `random(${seed} + vec2(${timeKey}))`;
  },
  description: 'Pseudo-random value 0..1. Changes every frame by default; connect Interval to hold it steady and only jump every N seconds.',
};
