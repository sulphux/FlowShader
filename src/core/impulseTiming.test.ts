import { describe, expect, it } from 'vitest';
import {
  buildImpulseEventTokenGLSL,
  impulseEventTokenAtTime,
  isImpulsePulseActive,
  safeImpulseInterval,
} from './impulseTiming';

describe('impulse timing', () => {
  it('shows why a narrow level pulse can be missed between render frames', () => {
    const interval = 0.05;
    const width = 0.01; // 0.5 ms pulse
    const renderTimes = [0.016, 0.083, 0.151];

    expect(renderTimes.map(time => isImpulsePulseActive(time, interval, width)))
      .toEqual([false, false, false]);
  });

  it('keeps a distinct event token after every interval boundary', () => {
    const interval = 0.05;
    const renderTimes = [0.016, 0.083, 0.151];
    const tokens = renderTimes.map(time => impulseEventTokenAtTime(time, interval));

    expect(tokens).toEqual([2, 3, 5]);
    expect(new Set(tokens).size).toBe(renderTimes.length);
  });

  it('clamps invalid and zero intervals consistently', () => {
    expect(safeImpulseInterval(0)).toBe(0.001);
    expect(safeImpulseInterval(Number.NaN)).toBe(1);
    expect(impulseEventTokenAtTime(0.003, 0)).toBe(5);
  });

  it('builds the same persistent token expression for the GPU writer', () => {
    expect(buildImpulseEventTokenGLSL('var_interval'))
      .toBe('(2.0 + floor(iTime / max(var_interval, 0.001)))');
  });
});
