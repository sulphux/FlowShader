import { describe, expect, it } from 'vitest';
import { buildShaderDebugReport, buildShaderDebugText } from './shaderDebugReport';
import type { ShaderValidationReport } from './validator';

describe('shaderDebugReport', () => {
  it('should build a detailed debug report including source and glslang output', () => {
    const report: ShaderValidationReport = {
      valid: false,
      error: 'line 4: syntax error',
      errors: [
        { severity: 'error', line: 4, message: 'syntax error', code: 'ERROR: 0:4: syntax error' },
      ],
      warnings: [
        { severity: 'warning', message: 'possible type mismatch: assigning vec3 expression to float' },
      ],
      source: 'glslang+heuristic',
      glslang: {
        available: true,
        ok: false,
        output: 'ERROR: shader.frag:4: syntax error',
        command: 'glslangValidator',
      },
    };

    const sections = buildShaderDebugReport(report);
    const text = buildShaderDebugText(report);

    expect(sections.summary).toContain('Shader validation failed');
    expect(sections.sources).toContain('validation-source: glslang+heuristic');
    expect(sections.sources).toContain('glslang: failed (glslangValidator)');
    expect(sections.errors[0]).toContain('L4: syntax error');
    expect(sections.warnings[0]).toContain('possible type mismatch');
    expect(sections.glslangOutput).toContain('syntax error');
    expect(text).toContain('Errors:');
    expect(text).toContain('Warnings:');
    expect(text).toContain('glslang output:');
  });

  it('should summarize successful validation without glslang output', () => {
    const report: ShaderValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      source: 'webgl',
    };

    const sections = buildShaderDebugReport(report);
    const text = buildShaderDebugText(report);

    expect(sections.summary).toBe('Shader validation passed | errors=0 | warnings=0');
    expect(sections.sources).toContain('validation-source: webgl');
    expect(sections.sources).toContain('glslang: unavailable');
    expect(sections.glslangOutput).toBeUndefined();
    expect(text).not.toContain('Errors:');
    expect(text).not.toContain('Warnings:');
  });
});
