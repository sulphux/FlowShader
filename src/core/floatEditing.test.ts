import { describe, expect, it } from 'vitest';
import { formatEditableFloat, parseEditableFloat, stepFloatValue } from './floatEditing';

describe('floatEditing', () => {
  it('accepts dot, comma and scientific notation', () => {
    expect(parseEditableFloat('0.001')).toBe(0.001);
    expect(parseEditableFloat('0,001')).toBe(0.001);
    expect(parseEditableFloat('1e-6')).toBe(0.000001);
    expect(parseEditableFloat('')).toBeNull();
    expect(parseEditableFloat('-')).toBeNull();
  });

  it('preserves small precision and removes binary artifacts', () => {
    expect(formatEditableFloat(0.001)).toBe('0.001');
    expect(formatEditableFloat(0.1 + 0.2)).toBe('0.3');
    expect(stepFloatValue(0.001, 0.001, 1)).toBe(0.002);
    expect(stepFloatValue(0.011, 0.01, -1)).toBe(0.001);
  });

  it('supports multipliers and clamps only nudged values', () => {
    expect(stepFloatValue(1, 0.1, 1, -10, 10, 10)).toBe(2);
    expect(stepFloatValue(-10, 0.1, -1, -10, 10)).toBe(-10);
  });
});

