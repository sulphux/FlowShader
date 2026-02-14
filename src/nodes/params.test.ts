import { describe, it, expect } from 'vitest';
import * as ParamNodes from './params';

describe('param nodes', () => {
  describe('FloatNode', () => {
    it('should generate float literal code', () => {
      const code = ParamNodes.FloatNode.glslTemplate({}, { value: 0.5 });
      expect(code).toBe('0.5');
    });

    it('should format integers with .0', () => {
      const code = ParamNodes.FloatNode.glslTemplate({}, { value: 1 });
      expect(code).toBe('1.0');
    });

    it('should use default value when no data provided', () => {
      const code = ParamNodes.FloatNode.glslTemplate({}, {});
      expect(code).toBe('0.5');
    });

    it('should handle undefined data', () => {
      const code = ParamNodes.FloatNode.glslTemplate({}, undefined);
      expect(code).toBe('0.5');
    });

    it('should have correct metadata', () => {
      expect(ParamNodes.FloatNode.id).toBe('param_float');
      expect(ParamNodes.FloatNode.label).toBe('Float Param');
      expect(ParamNodes.FloatNode.inputs).toHaveLength(0);
      expect(ParamNodes.FloatNode.outputs).toHaveLength(1);
      expect(ParamNodes.FloatNode.outputs[0].type).toBe('float');
    });

    it('should have float controls', () => {
      expect(ParamNodes.FloatNode.controls).toBeDefined();
      expect(ParamNodes.FloatNode.controls?.type).toBe('float');
      expect(ParamNodes.FloatNode.controls?.defaultValue).toBe(0.5);
      expect(ParamNodes.FloatNode.controls?.min).toBe(0.0);
      expect(ParamNodes.FloatNode.controls?.max).toBe(10.0);
      expect(ParamNodes.FloatNode.controls?.step).toBe(0.01);
    });

    it('should handle various float values', () => {
      expect(ParamNodes.FloatNode.glslTemplate({}, { value: 0 })).toBe('0.0');
      expect(ParamNodes.FloatNode.glslTemplate({}, { value: 10 })).toBe('10.0');
      expect(ParamNodes.FloatNode.glslTemplate({}, { value: 3.14159 })).toBe('3.14159');
      expect(ParamNodes.FloatNode.glslTemplate({}, { value: -5.5 })).toBe('-5.5');
    });

    it('should handle NaN gracefully', () => {
      const code = ParamNodes.FloatNode.glslTemplate({}, { value: 'invalid' });
      expect(code).toBe('0.0');
    });
  });

  describe('ColorNode', () => {
    it('should convert hex color to vec3', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#ff0000' });
      expect(code).toMatch(/vec3\(1\.0, 0\.0, 0\.0\)/);
    });

    it('should handle green color', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#00ff00' });
      expect(code).toMatch(/vec3\(0\.0, 1\.0, 0\.0\)/);
    });

    it('should handle blue color', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#0000ff' });
      expect(code).toMatch(/vec3\(0\.0, 0\.0, 1\.0\)/);
    });

    it('should handle white color', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#ffffff' });
      expect(code).toMatch(/vec3\(1\.0, 1\.0, 1\.0\)/);
    });

    it('should handle black color', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#000000' });
      expect(code).toMatch(/vec3\(0\.0, 0\.0, 0\.0\)/);
    });

    it('should use default color when no data provided', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, {});
      expect(code).toContain('vec3(');
    });

    it('should handle undefined data', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, undefined);
      expect(code).toContain('vec3(');
    });

    it('should have correct metadata', () => {
      expect(ParamNodes.ColorNode.id).toBe('param_color');
      expect(ParamNodes.ColorNode.label).toBe('Color Param');
      expect(ParamNodes.ColorNode.inputs).toHaveLength(0);
      expect(ParamNodes.ColorNode.outputs).toHaveLength(1);
      expect(ParamNodes.ColorNode.outputs[0].type).toBe('vec3');
    });

    it('should have color controls', () => {
      expect(ParamNodes.ColorNode.controls).toBeDefined();
      expect(ParamNodes.ColorNode.controls?.type).toBe('color');
      expect(ParamNodes.ColorNode.controls?.defaultValue).toBe('#ff007a');
    });

    it('should handle mixed colors', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#7f7f7f' });
      expect(code).toContain('vec3(');
      expect(code).toMatch(/0\.49[89]/); // ~0.498 for 127/255
    });

    it('should always produce valid GLSL vec3 format', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#123456'];
      
      colors.forEach(color => {
        const code = ParamNodes.ColorNode.glslTemplate({}, { value: color });
        expect(code).toMatch(/^vec3\([\d.]+, [\d.]+, [\d.]+\)$/);
      });
    });
  });

  describe('Param Nodes Structure', () => {
    const paramNodes = [
      ParamNodes.FloatNode,
      ParamNodes.ColorNode
    ];

    it('should all have unique IDs', () => {
      const ids = paramNodes.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have labels', () => {
      paramNodes.forEach(node => {
        expect(node.label).toBeDefined();
        expect(node.label.length).toBeGreaterThan(0);
      });
    });

    it('should all have no inputs', () => {
      paramNodes.forEach(node => {
        expect(node.inputs).toHaveLength(0);
      });
    });

    it('should all have exactly one output', () => {
      paramNodes.forEach(node => {
        expect(node.outputs).toHaveLength(1);
      });
    });

    it('should all have controls', () => {
      paramNodes.forEach(node => {
        expect(node.controls).toBeDefined();
        expect(node.controls?.type).toBeDefined();
        expect(node.controls?.defaultValue).toBeDefined();
      });
    });

    it('should all have glslTemplate function', () => {
      paramNodes.forEach(node => {
        expect(typeof node.glslTemplate).toBe('function');
      });
    });
  });

  describe('Float formatting utility', () => {
    it('should format various number types correctly', () => {
      const testCases = [
        { input: 0, expected: '0.0' },
        { input: 1, expected: '1.0' },
        { input: -1, expected: '-1.0' },
        { input: 0.5, expected: '0.5' },
        { input: 3.14159, expected: '3.14159' },
        { input: 100, expected: '100.0' },
      ];

      testCases.forEach(({ input, expected }) => {
        const code = ParamNodes.FloatNode.glslTemplate({}, { value: input });
        expect(code).toBe(expected);
      });
    });
  });

  describe('Hex to vec3 conversion', () => {
    it('should convert primary colors correctly', () => {
      const red = ParamNodes.ColorNode.glslTemplate({}, { value: '#ff0000' });
      expect(red).toContain('1.0, 0.0, 0.0');

      const green = ParamNodes.ColorNode.glslTemplate({}, { value: '#00ff00' });
      expect(green).toContain('0.0, 1.0, 0.0');

      const blue = ParamNodes.ColorNode.glslTemplate({}, { value: '#0000ff' });
      expect(blue).toContain('0.0, 0.0, 1.0');
    });

    it('should normalize color values to 0-1 range', () => {
      const code = ParamNodes.ColorNode.glslTemplate({}, { value: '#808080' });
      expect(code).toMatch(/vec3\(0\.50/); // 128/255 ≈ 0.502
    });
  });
});
