import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import { getShaderValidationReport } from '../core/validator';

/**
 * Offline GLSL validation (requires glslangValidator available in PATH).
 * This is the first "real" shader compilation gate we can run in CI without a GPU.
 */
describe('GLSL validation via glslangValidator', () => {
  it('should validate a minimal compiled fragment shader', { timeout: 15000 }, () => {
    expect(hasGlslangValidator()).toBe(true);
    const nodes = [
      {
        id: 'float_1',
        type: 'shaderNode',
        data: {
          definition: NODE_REGISTRY['param_float'],
          value: 0.5,
        },
      },
      {
        id: 'output_1',
        type: 'shaderNode',
        data: {
          definition: NODE_REGISTRY['output'],
        },
      },
    ];

    const edges = [
      {
        id: 'e1',
        source: 'float_1',
        sourceHandle: 'value',
        target: 'output_1',
        targetHandle: 'in',
      },
    ];

    const glsl = compileGraphToGLSL(nodes as any, edges as any, 'output_1');
    const res = validateWithGlslangValidator(glsl, 'frag');
    const report = getShaderValidationReport(glsl);

    expect(res.ok).toBe(true);
    expect(report.valid).toBe(true);
    expect(report.glslang?.available).toBe(true);
    expect(report.glslang?.ok).toBe(true);
    expect(report.source).toMatch(/glslang/);
  });
});
