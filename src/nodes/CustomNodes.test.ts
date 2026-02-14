import { describe, it, expect } from 'vitest';
import { CustomInputNode } from './CustomInput';
import { CustomOutputNode } from './CustomOutput';

describe('Custom Nodes', () => {
  describe('CustomInputNode', () => {
    it('should have correct node definition', () => {
      expect(CustomInputNode.id).toBe('custom_input');
      expect(CustomInputNode.label).toBe('Input');
    });

    it('should have no inputs and one auto output', () => {
      expect(CustomInputNode.inputs).toHaveLength(0);
      expect(CustomInputNode.outputs).toHaveLength(1);
      expect(CustomInputNode.outputs[0].type).toBe('auto');
    });

    it('should have text control for port naming', () => {
      expect(CustomInputNode.controls?.type).toBe('text');
      expect(CustomInputNode.controls?.defaultValue).toBe('Input');
    });

    it('should generate placeholder GLSL', () => {
      const glsl = CustomInputNode.glslTemplate({});
      expect(glsl).toBeTruthy();
      expect(typeof glsl).toBe('string');
    });
  });

  describe('CustomOutputNode', () => {
    it('should have correct node definition', () => {
      expect(CustomOutputNode.id).toBe('custom_output');
      expect(CustomOutputNode.label).toBe('Output');
    });

    it('should have one auto input and no outputs', () => {
      expect(CustomOutputNode.inputs).toHaveLength(1);
      expect(CustomOutputNode.inputs[0].type).toBe('auto');
      expect(CustomOutputNode.outputs).toHaveLength(0); // Custom Output has no outputs
    });

    it('should pass through input value in GLSL', () => {
      const glsl = CustomOutputNode.glslTemplate({ in: 'vec3(1.0)' });
      expect(glsl).toBe('vec3(1.0)');
    });

    it('should have fallback for missing input', () => {
      const glsl = CustomOutputNode.glslTemplate({});
      expect(glsl).toBeTruthy();
      expect(glsl).toContain('vec3');
    });
  });
});
