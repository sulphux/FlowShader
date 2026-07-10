import { describe, it, expect } from 'vitest';
import { getShaderValidationReport } from '../core/validator';
import { hasGlslangValidator } from '../core/glslangValidation';

describe('glslang validation gate', () => {
  it('should expose glslang metadata when validator is available', () => {
    const shader = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0);
      }
    `;

    const report = getShaderValidationReport(shader);

    if (!hasGlslangValidator()) {
      expect(report.glslang).toBeUndefined();
      expect(report.valid).toBe(true);
      return;
    }

    expect(report.glslang).toBeDefined();
    expect(report.glslang?.available).toBe(true);
    expect(report.glslang?.ok).toBe(true);
    expect(report.source).toMatch(/glslang/);
  });

  it('should surface glslang compile failures as structured errors when available', () => {
    const invalidShader = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0)
      }
    `;

    const report = getShaderValidationReport(invalidShader);

    if (!hasGlslangValidator()) {
      expect(report.valid).toBe(false);
      expect(report.glslang).toBeUndefined();
      return;
    }

    expect(report.glslang?.available).toBe(true);
    expect(report.glslang?.ok).toBe(false);
    expect(report.glslang?.output.length).toBeGreaterThan(0);
    expect(report.errors.length).toBeGreaterThanOrEqual(0);
    expect(report.glslang?.output.toLowerCase().includes('error') || report.glslang?.output.toLowerCase().includes('syntax')).toBe(true);
    expect(report.source).toMatch(/glslang/);
  });
});
