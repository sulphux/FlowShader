import type { ShaderNodeDefinition } from '../core/types';
import { feedbackUniformName } from '../core/runtimeResources';

/**
 * Nody symulacji: Frame Buffer (snapshot lub poprzednia klatka), Impulse (okresowy puls
 * wyzwalający zapis) i Random (szum opcjonalnie trzymany w oknie czasowym).
 * Każdy Feedback jest osobnym przebiegiem i parą buforów ping-pong; Impulse i
 * Random pozostają bezstanowymi funkcjami iTime.
 */

export const FeedbackNode: ShaderNodeDefinition = {
  id: 'feedback',
  label: 'Frame Buffer',
  inputs: [
    { id: 'in', label: 'Image In', type: 'vec3' },
    { id: 'impulse', label: 'Snapshot', type: 'impulse|float' },
    { id: 'uv', label: 'Sample UV (Advanced)', type: 'vec2' },
  ],
  outputs: [
    { id: 'rgb', label: 'Stored Image', type: 'vec3' },
    { id: 'buffer', label: 'Buffer2D', type: 'buffer2d' },
  ],
  glslTemplate: (inputs, data) => {
    // Frame Buffer targets have the same pixel dimensions as the preview.
    // Centered `uv` is aspect-corrected for SDFs, so mapping it back with
    // `uv * .5 + .5` stretches/clamps non-square previews. screenUv is the
    // actual normalized framebuffer coordinate.
    const coords = inputs.uv || 'screenUv';
    const uniform = feedbackUniformName(String(data?.nodeId ?? 'feedback'));
    return `texture2D(${uniform}, ${coords}).rgb`;
  },
  description: 'Stores Image In in its own frame buffer. SNAPSHOT captures once per event. LAST FRAME automatically stores every render and outputs the previous completed frame. Stored Image reads one location directly; Buffer2D can fan out to any number of Sample Buffer nodes.',
};

const glslFloat = (value: unknown, fallback: number): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback.toFixed(1);
  return Number.isInteger(numeric) ? numeric.toFixed(1) : String(numeric);
};

export const SampleBufferNode: ShaderNodeDefinition = {
  id: 'sample_buffer',
  label: 'Sample Buffer',
  inputs: [
    { id: 'buffer', label: 'Buffer2D', type: 'buffer2d' },
    { id: 'uv', label: 'UV (optional)', type: 'vec2' },
    { id: 'offsetX', label: 'Offset X (px)', type: 'float' },
    { id: 'offsetY', label: 'Offset Y (px)', type: 'float' },
  ],
  outputs: [{ id: 'rgb', label: 'RGB', type: 'vec3' }],
  glslTemplate: (inputs, data) => {
    if (!inputs.buffer) return 'vec3(0.0)';
    const uv = inputs.uv || 'screenUv';
    const offsetX = inputs.offsetX || glslFloat(data?.offsetX, 0);
    const offsetY = inputs.offsetY || glslFloat(data?.offsetY, 0);
    const shifted = `((${uv}) + vec2(${offsetX}, ${offsetY}) / iResolution.xy)`;
    const coords = data?.sampleWrap === 'clamp'
      ? `clamp(${shifted}, vec2(0.0), vec2(1.0))`
      : `fract(${shifted})`;
    return `texture2D(${inputs.buffer}, ${coords}).rgb`;
  },
  description: 'Samples a Buffer2D resource. Duplicate this node to read the same Frame Buffer at any number of UVs or pixel offsets. Repeat wraps at the edges; Clamp stops at the edge.',
};

export const ImpulseNode: ShaderNodeDefinition = {
  id: 'impulse',
  label: 'Impulse',
  inputs: [
    { id: 'interval', label: 'Interval', type: 'float' },
    { id: 'width', label: 'Pulse Width', type: 'float' },
  ],
  outputs: [{ id: 'out', label: 'Event', type: 'impulse' }],
  // Semantic impulse is represented by a scalar in generated GLSL.
  varType: 'float',
  glslTemplate: (inputs) => {
    const interval = inputs.interval || '1.0';
    const width = inputs.width || '0.05';
    return `((mod(iTime, max(${interval}, 0.001)) < (${interval} * clamp(${width}, 0.0, 1.0))) ? 1.0 : 0.0)`;
  },
  description: 'Emits an event every "Interval" seconds. Pulse Width may be any fraction from 0 to 1, including values below 0.05. Frame Buffer latches interval boundaries, so even an event shorter than one rendered frame cannot be missed.',
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
