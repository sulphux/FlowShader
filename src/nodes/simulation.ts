import type { ShaderNodeDefinition } from '../core/types';
import { feedbackUniformName } from '../core/runtimeResources';

/**
 * Nody symulacji: Feedback (własny pamiętany snapshot), Impulse (okresowy puls
 * wyzwalający zapis) i Random (szum opcjonalnie trzymany w oknie czasowym).
 * Każdy Feedback jest osobnym przebiegiem i parą buforów ping-pong; Impulse i
 * Random pozostają bezstanowymi funkcjami iTime.
 */

export const FeedbackNode: ShaderNodeDefinition = {
  id: 'feedback',
  label: 'Frame Buffer',
  inputs: [
    { id: 'in', label: 'Image In', type: 'vec3' },
    { id: 'impulse', label: 'Snapshot', type: 'float' },
    { id: 'uv', label: 'Sample UV (Advanced)', type: 'vec2' },
  ],
  outputs: [{ id: 'rgb', label: 'Stored Image', type: 'vec3' }],
  glslTemplate: (inputs, data) => {
    // Frame Buffer targets have the same pixel dimensions as the preview.
    // Centered `uv` is aspect-corrected for SDFs, so mapping it back with
    // `uv * .5 + .5` stretches/clamps non-square previews. screenUv is the
    // actual normalized framebuffer coordinate.
    const coords = inputs.uv || 'screenUv';
    const uniform = feedbackUniformName(String(data?.nodeId ?? 'feedback'));
    return `texture2D(${uniform}, ${coords}).rgb`;
  },
  description: 'Stores Image In in its own frame buffer. Snapshot captures once on the 0 → 1 edge; keeping it high does not write again. When disconnected, it captures every frame. Sample UV is an advanced optional input for reading another location in the stored image.',
};

export const ImpulseNode: ShaderNodeDefinition = {
  id: 'impulse',
  label: 'Impulse',
  inputs: [
    { id: 'interval', label: 'Interval', type: 'float' },
    { id: 'width', label: 'Pulse Width', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Pulse', type: 'float' }],
  glslTemplate: (inputs) => {
    const interval = inputs.interval || '1.0';
    const width = inputs.width || '0.05';
    return `((mod(iTime, max(${interval}, 0.001)) < (${interval} * ${width})) ? 1.0 : 0.0)`;
  },
  description: 'Emits a brief 1.0 pulse every "Interval" seconds, 0.0 otherwise. When connected directly to Frame Buffer Snapshot, the engine latches each interval boundary so even a pulse shorter than one frame cannot be missed.',
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
