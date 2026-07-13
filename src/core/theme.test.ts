import { describe, it, expect } from 'vitest';
import { TYPE_COLORS, TYPE_NAMES } from './theme';
import type { DataType } from './types';

describe('Theme System', () => {
  describe('TYPE_COLORS', () => {
    it('should have colors for all data types', () => {
      const types: DataType[] = ['float', 'impulse', 'vec2', 'vec3', 'vec4', 'buffer2d', 'auto'];
      
      types.forEach(type => {
        expect(TYPE_COLORS[type]).toBeDefined();
        expect(TYPE_COLORS[type]).toMatch(/^#[0-9a-fA-F]{6}$/); // Valid hex color
      });
    });

    it('should have distinct colors for each type', () => {
      const colors = Object.values(TYPE_COLORS).filter(c => c !== '#ffffff');
      const uniqueColors = new Set(colors);
      
      expect(uniqueColors.size).toBeGreaterThanOrEqual(6);
    });

    it('should have default fallback color', () => {
      expect(TYPE_COLORS.default).toBe('#ffffff');
    });
  });

  describe('TYPE_NAMES', () => {
    it('should have human-readable names for all types', () => {
      const types: DataType[] = ['float', 'impulse', 'vec2', 'vec3', 'vec4', 'buffer2d', 'auto'];
      
      types.forEach(type => {
        expect(TYPE_NAMES[type]).toBeDefined();
        expect(TYPE_NAMES[type].length).toBeGreaterThan(0);
      });
    });

    it('should provide context in names', () => {
      expect(TYPE_NAMES.vec2).toContain('UV');
      expect(TYPE_NAMES.vec3).toContain('RGB');
      expect(TYPE_NAMES.vec4).toContain('RGBA');
      expect(TYPE_NAMES.auto).toContain('Dynamic');
      expect(TYPE_NAMES.impulse).toContain('Event');
    });
  });
});
