import { describe, it, expect } from 'vitest';
import { 
  validateConnection, 
  isValidConnection, 
  getValidTargetTypes,
  isValidSwizzle 
} from './connectionValidator';
import type { DataType } from './types';

describe('connectionValidator', () => {
  describe('validateConnection', () => {
    describe('Rule 1: Same type connections (always valid)', () => {
      const sameTypeTests: DataType[] = ['float', 'vec2', 'vec3', 'vec4'];

      sameTypeTests.forEach(type => {
        it(`should allow ${type} → ${type}`, () => {
          const result = validateConnection(type, type);
          expect(result.valid).toBe(true);
          expect(result.reason).toBeUndefined();
        });
      });
    });

    describe('Rule 2: float → vector BLOCKED (Auto-Adapter)', () => {
      it('should block float → vec2', () => {
        const result = validateConnection('float', 'vec2');
        expect(result.valid).toBe(false);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Combine');
      });

      it('should block float → vec3', () => {
        const result = validateConnection('float', 'vec3');
        expect(result.valid).toBe(false);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Combine');
      });

      it('should block float → vec4', () => {
        const result = validateConnection('float', 'vec4');
        expect(result.valid).toBe(false);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Combine');
      });
    });

    describe('Rule 3: vector → float BLOCKED (Auto-Adapter)', () => {
      it('should block vec2 → float', () => {
        const result = validateConnection('vec2', 'float');
        expect(result.valid).toBe(false);
        expect(result.requiresSplit).toBe(true);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Split');
      });

      it('should block vec3 → float', () => {
        const result = validateConnection('vec3', 'float');
        expect(result.valid).toBe(false);
        expect(result.requiresSplit).toBe(true);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Split');
      });

      it('should block vec4 → float', () => {
        const result = validateConnection('vec4', 'float');
        expect(result.valid).toBe(false);
        expect(result.requiresSplit).toBe(true);
        expect(result.requiresAdapter).toBe(true);
        expect(result.reason).toContain('Auto-inserting Split');
      });
    });

    describe('Rule 4: Different vector types (BLOCKED)', () => {
      it('should block vec2 → vec3', () => {
        const result = validateConnection('vec2', 'vec3');
        expect(result.valid).toBe(false);
        expect(result.requiresAdapter).toBe(true);
        expect(result.requiresSplit).toBe(false);
        expect(result.reason).toContain('Auto-inserting Split + Combine');
      });

      it('should block vec2 → vec4', () => {
        const result = validateConnection('vec2', 'vec4');
        expect(result.valid).toBe(false);
      });

      it('should block vec3 → vec2', () => {
        const result = validateConnection('vec3', 'vec2');
        expect(result.valid).toBe(false);
      });

      it('should block vec3 → vec4', () => {
        const result = validateConnection('vec3', 'vec4');
        expect(result.valid).toBe(false);
      });

      it('should block vec4 → vec2', () => {
        const result = validateConnection('vec4', 'vec2');
        expect(result.valid).toBe(false);
      });

      it('should block vec4 → vec3', () => {
        const result = validateConnection('vec4', 'vec3');
        expect(result.valid).toBe(false);
      });
    });

    describe('Rule 5: auto type (universal adapter)', () => {
      const concreteTypes: DataType[] = ['float', 'vec2', 'vec3', 'vec4'];

      it('should allow auto → any type', () => {
        concreteTypes.forEach(type => {
          const result = validateConnection('auto', type);
          expect(result.valid).toBe(true);
        });
      });

      it('should allow any type → auto', () => {
        concreteTypes.forEach(type => {
          const result = validateConnection(type, 'auto');
          expect(result.valid).toBe(true);
        });
      });

      it('should allow auto → auto', () => {
        const result = validateConnection('auto', 'auto');
        expect(result.valid).toBe(true);
      });
    });

    describe('Rule 6: Multi-type ports (e.g., "float|vec3")', () => {
      it('should allow float → "float|vec3" port', () => {
        const result = validateConnection('float', 'float|vec3');
        expect(result.valid).toBe(true);
      });

      it('should prefer a valid pair when multi-type source includes an invalid combination first', () => {
        const result = validateConnection('vec2|float', 'float');
        expect(result.valid).toBe(true);
        expect(result.requiresAdapter).toBeUndefined();
      });

      it('should prefer a valid pair when multi-type target includes an invalid combination first', () => {
        const result = validateConnection('float', 'vec3|float');
        expect(result.valid).toBe(true);
        expect(result.requiresAdapter).toBeUndefined();
      });

      it('should return a meaningful adapter error when no multi-type combination matches', () => {
        const result = validateConnection('vec4|vec3', 'float|vec2');
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.requiresAdapter).toBe(true);
      });

      it('should allow vec3 → "float|vec3" port', () => {
        const result = validateConnection('vec3', 'float|vec3');
        expect(result.valid).toBe(true);
      });

      it('should block vec2 → "float|vec3" port', () => {
        const result = validateConnection('vec2', 'float|vec3');
        expect(result.valid).toBe(false);
      });

      it('should block vec4 → "float|vec3" port', () => {
        const result = validateConnection('vec4', 'float|vec3');
        expect(result.valid).toBe(false);
      });

      it('should handle multi-type source ports', () => {
        const result = validateConnection('float|vec3', 'vec3');
        expect(result.valid).toBe(true);
      });

      it('should work with 3+ types', () => {
        expect(validateConnection('float', 'float|vec2|vec3')).toMatchObject({ valid: true });
        expect(validateConnection('vec2', 'float|vec2|vec3')).toMatchObject({ valid: true });
        expect(validateConnection('vec3', 'float|vec2|vec3')).toMatchObject({ valid: true });
        expect(validateConnection('vec4', 'float|vec2|vec3')).toMatchObject({ valid: false });
      });
    });

    describe('Complete connection matrix', () => {
      const allTypes: DataType[] = ['float', 'vec2', 'vec3', 'vec4'];
      
      it('should have correct validation for all type combinations', () => {
        const expectedResults: Record<string, boolean> = {
          // float source
          'float→float': true,
          'float→vec2': false,
          'float→vec3': false,
          'float→vec4': false,
          
          // vec2 source
          'vec2→float': false,
          'vec2→vec2': true,
          'vec2→vec3': false,
          'vec2→vec4': false,
          
          // vec3 source
          'vec3→float': false,
          'vec3→vec2': false,
          'vec3→vec3': true,
          'vec3→vec4': false,
          
          // vec4 source
          'vec4→float': false,
          'vec4→vec2': false,
          'vec4→vec3': false,
          'vec4→vec4': true,
        };

        allTypes.forEach(source => {
          allTypes.forEach(target => {
            const key = `${source}→${target}`;
            const result = validateConnection(source, target);
            const expected = expectedResults[key];
            
            expect(result.valid).toBe(expected);
          });
        });
      });
    });
  });

  describe('isValidConnection', () => {
    it('should return true for valid connections', () => {
      expect(isValidConnection('float', 'float')).toBe(true);
      expect(isValidConnection('vec2', 'vec2')).toBe(true);
    });

    it('should return false for invalid connections', () => {
      expect(isValidConnection('float', 'vec3')).toBe(false);
      expect(isValidConnection('vec3', 'float')).toBe(false);
      expect(isValidConnection('vec2', 'vec4')).toBe(false);
      expect(isValidConnection('vec4', 'vec2')).toBe(false);
    });
  });

  describe('getValidTargetTypes', () => {
    it('should return all types for auto source', () => {
      const validTargets = getValidTargetTypes('auto');
      expect(validTargets).toEqual(['float', 'vec2', 'vec3', 'vec4', 'auto']);
    });

    it('should return only float + auto for float source', () => {
      const validTargets = getValidTargetTypes('float');
      expect(validTargets).toContain('float');
      expect(validTargets).toContain('auto');
      expect(validTargets).not.toContain('vec2');
      expect(validTargets).not.toContain('vec3');
      expect(validTargets).not.toContain('vec4');
      expect(validTargets.length).toBe(2);
    });

    it('should return only same type + auto for vec2 source', () => {
      const validTargets = getValidTargetTypes('vec2');
      expect(validTargets).toContain('vec2');
      expect(validTargets).toContain('auto');
      expect(validTargets.length).toBe(2);
    });

    it('should return only same type + auto for vec3 source', () => {
      const validTargets = getValidTargetTypes('vec3');
      expect(validTargets).toContain('vec3');
      expect(validTargets).toContain('auto');
      expect(validTargets.length).toBe(2);
    });

    it('should return only same type + auto for vec4 source', () => {
      const validTargets = getValidTargetTypes('vec4');
      expect(validTargets).toContain('vec4');
      expect(validTargets).toContain('auto');
      expect(validTargets.length).toBe(2);
    });
  });

  describe('isValidSwizzle', () => {
    describe('float (no swizzling)', () => {
      it('should not allow any swizzle on float', () => {
        expect(isValidSwizzle('float', 'x')).toBe(false);
        expect(isValidSwizzle('float', 'y')).toBe(false);
        expect(isValidSwizzle('float', 'z')).toBe(false);
        expect(isValidSwizzle('float', 'w')).toBe(false);
      });
    });

    describe('vec2 swizzling', () => {
      it('should allow x and y components', () => {
        expect(isValidSwizzle('vec2', 'x')).toBe(true);
        expect(isValidSwizzle('vec2', 'y')).toBe(true);
      });

      it('should allow r and g components (color alias)', () => {
        expect(isValidSwizzle('vec2', 'r')).toBe(true);
        expect(isValidSwizzle('vec2', 'g')).toBe(true);
      });

      it('should not allow z, w, b, a components', () => {
        expect(isValidSwizzle('vec2', 'z')).toBe(false);
        expect(isValidSwizzle('vec2', 'w')).toBe(false);
        expect(isValidSwizzle('vec2', 'b')).toBe(false);
        expect(isValidSwizzle('vec2', 'a')).toBe(false);
      });
    });

    describe('vec3 swizzling', () => {
      it('should allow x, y, z components', () => {
        expect(isValidSwizzle('vec3', 'x')).toBe(true);
        expect(isValidSwizzle('vec3', 'y')).toBe(true);
        expect(isValidSwizzle('vec3', 'z')).toBe(true);
      });

      it('should allow r, g, b components (color alias)', () => {
        expect(isValidSwizzle('vec3', 'r')).toBe(true);
        expect(isValidSwizzle('vec3', 'g')).toBe(true);
        expect(isValidSwizzle('vec3', 'b')).toBe(true);
      });

      it('should not allow w or a components', () => {
        expect(isValidSwizzle('vec3', 'w')).toBe(false);
        expect(isValidSwizzle('vec3', 'a')).toBe(false);
      });
    });

    describe('vec4 swizzling', () => {
      it('should allow all x, y, z, w components', () => {
        expect(isValidSwizzle('vec4', 'x')).toBe(true);
        expect(isValidSwizzle('vec4', 'y')).toBe(true);
        expect(isValidSwizzle('vec4', 'z')).toBe(true);
        expect(isValidSwizzle('vec4', 'w')).toBe(true);
      });

      it('should allow all r, g, b, a components (color alias)', () => {
        expect(isValidSwizzle('vec4', 'r')).toBe(true);
        expect(isValidSwizzle('vec4', 'g')).toBe(true);
        expect(isValidSwizzle('vec4', 'b')).toBe(true);
        expect(isValidSwizzle('vec4', 'a')).toBe(true);
      });
    });

    describe('Invalid swizzle components', () => {
      it('should not allow invalid component names', () => {
        expect(isValidSwizzle('vec3', 'invalid')).toBe(false);
        expect(isValidSwizzle('vec4', 'foo')).toBe(false);
        expect(isValidSwizzle('vec2', '1')).toBe(false);
      });
    });
  });

  describe('Integration tests - Real-world scenarios', () => {
    it('Scenario: Time (float) → Color Add (vec3) - should fail with adapter', () => {
      const result = validateConnection('float', 'vec3');
      expect(result.valid).toBe(false);
      expect(result.requiresAdapter).toBe(true);
    });

    it('Scenario: UV (vec2) → Length (vec2) - should work', () => {
      const result = validateConnection('vec2', 'vec2');
      expect(result.valid).toBe(true);
    });

    it('Scenario: UV (vec2) → Sin (float) - should fail', () => {
      const result = validateConnection('vec2', 'float');
      expect(result.valid).toBe(false);
      expect(result.requiresSplit).toBe(true);
    });

    it('Scenario: Color (vec3) → Output (vec4) - should fail', () => {
      const result = validateConnection('vec3', 'vec4');
      expect(result.valid).toBe(false);
    });

    it('Scenario: Split vec3.x (float via swizzle) - swizzle should be valid', () => {
      expect(isValidSwizzle('vec3', 'x')).toBe(true);
      // After swizzling, we get float which can connect to float
      expect(isValidConnection('float', 'float')).toBe(true);
    });

    it('Scenario: Multiple floats → vec3 combine - each connection valid', () => {
      // Three separate float → float connections for x, y, z inputs
      expect(isValidConnection('float', 'float')).toBe(true);
      expect(isValidConnection('float', 'float')).toBe(true);
      expect(isValidConnection('float', 'float')).toBe(true);
    });

    it('Scenario: Any type → Auto Relay - should work', () => {
      expect(isValidConnection('float', 'auto')).toBe(true);
      expect(isValidConnection('vec2', 'auto')).toBe(true);
      expect(isValidConnection('vec3', 'auto')).toBe(true);
      expect(isValidConnection('vec4', 'auto')).toBe(true);
    });

    it('Scenario: Auto Relay → Any type - should work', () => {
      expect(isValidConnection('auto', 'float')).toBe(true);
      expect(isValidConnection('auto', 'vec2')).toBe(true);
      expect(isValidConnection('auto', 'vec3')).toBe(true);
      expect(isValidConnection('auto', 'vec4')).toBe(true);
    });

    it('Scenario: vec3 → Smart Split (auto) - should work', () => {
      const result = validateConnection('vec3', 'auto');
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle all 16 possible type combinations', () => {
      const types: DataType[] = ['float', 'vec2', 'vec3', 'vec4'];
      let testCount = 0;

      types.forEach(source => {
        types.forEach(target => {
          const result = validateConnection(source, target);
          expect(result).toBeDefined();
          expect(typeof result.valid).toBe('boolean');
          testCount++;
        });
      });

      expect(testCount).toBe(16); // 4x4 matrix
    });

    it('should provide reasons for all invalid connections', () => {
      const invalidConnections: Array<[DataType, DataType]> = [
        ['vec2', 'float'],
        ['vec3', 'float'],
        ['vec4', 'float'],
        ['vec2', 'vec3'],
        ['vec2', 'vec4'],
        ['vec3', 'vec2'],
        ['vec3', 'vec4'],
        ['vec4', 'vec2'],
        ['vec4', 'vec3'],
      ];

      invalidConnections.forEach(([source, target]) => {
        const result = validateConnection(source, target);
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason!.length).toBeGreaterThan(0);
      });
    });
  });
});
