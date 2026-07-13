import { describe, expect, it } from 'vitest';
import {
  buildImpulseEventTokenGLSL,
  impulseCycleAtTime,
  impulseEventTokenAtTime,
  isImpulsePulseActive,
  resolveImpulseTiming,
  safeImpulseInterval,
} from './impulseTiming';

describe('impulse timing', () => {
  it('shows why a narrow level pulse can be missed between render frames', () => {
    const interval = 0.05;
    const width = 0.01;
    const renderTimes = [0.016, 0.083, 0.151];
    expect(renderTimes.map(time => isImpulsePulseActive(time, interval, width)))
      .toEqual([false, false, false]);
  });

  it('keeps a distinct event token after every interval boundary', () => {
    const tokens = [0.016, 0.083, 0.151].map(time => impulseEventTokenAtTime(time, 0.05));
    expect(tokens).toEqual([2, 3, 5]);
    expect(new Set(tokens).size).toBe(tokens.length);
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

  it('supports a pulse width far below 0.05', () => {
    expect(isImpulsePulseActive(0.0005, 1, 0.001)).toBe(true);
    expect(isImpulsePulseActive(0.002, 1, 0.001)).toBe(false);
  });

  it('clamps invalid duty cycles but keeps event cycles stable', () => {
    expect(isImpulsePulseActive(0.5, 1, 2)).toBe(true);
    expect(isImpulsePulseActive(0, 1, -1)).toBe(false);
    expect(impulseCycleAtTime(2.2, 1)).toBe(2);
    expect(impulseEventTokenAtTime(2.2, 1)).not.toBe(impulseEventTokenAtTime(1.9, 1));
  });

  it('resolves precise Float Param inputs for the LED and event edge', () => {
    const timing = resolveImpulseTiming('imp', [
      { id: 'width', data: { value: '0.001', definition: { id: 'param_float' } } },
    ], [
      { source: 'width', target: 'imp', targetHandle: 'width' },
    ]);
    expect(timing.width).toBe(0.001);
    expect(timing.widthDriven).toBe(true);
    expect(timing.widthResolved).toBe(true);
  });
});
