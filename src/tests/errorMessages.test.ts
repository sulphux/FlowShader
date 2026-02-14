import { describe, it, expect } from 'vitest';
import { validateConnection } from '../core/connectionValidator';

describe('Error Messages Quality', () => {
  it('should provide helpful error for vector → float connection', () => {
    const result = validateConnection('vec3', 'float');
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Split');
    expect(result.reason).toContain('vec3');
    expect(result.reason).toContain('float');
  });

  it('should provide helpful error for incompatible vector sizes', () => {
    const result = validateConnection('vec4', 'vec2');
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.reason!.length).toBeGreaterThan(20); // Meaningful message
  });

  it('should not provide reason for valid connections', () => {
    const result = validateConnection('float', 'vec3');
    
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should explain auto type behavior', () => {
    const result = validateConnection('vec2', 'auto');
    
    expect(result.valid).toBe(true);
    // Auto accepts anything - no error message needed
  });
});
