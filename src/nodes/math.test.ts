import { describe, it, expect } from 'vitest';
import * as MathNodes from './math';

describe('math nodes', () => {
  describe('AddNode', () => {
    it('should generate addition GLSL code', () => {
      const code = MathNodes.AddNode.glslTemplate({ a: '1.0', b: '2.0' });
      expect(code).toBe('(1.0 + 2.0)');
    });

    it('should handle missing inputs with defaults', () => {
      const code = MathNodes.AddNode.glslTemplate({});
      expect(code).toBe('(0.0 + 0.0)');
    });

    it('should have correct metadata', () => {
      expect(MathNodes.AddNode.id).toBe('math_add');
      expect(MathNodes.AddNode.label).toBe('+');
      expect(MathNodes.AddNode.compact).toBe(true);
      expect(MathNodes.AddNode.inputs).toHaveLength(2);
      expect(MathNodes.AddNode.outputs).toHaveLength(1);
    });
  });

  describe('SubNode', () => {
    it('should generate subtraction GLSL code', () => {
      const code = MathNodes.SubNode.glslTemplate({ a: '5.0', b: '3.0' });
      expect(code).toBe('(5.0 - 3.0)');
    });

    it('should handle missing inputs', () => {
      const code = MathNodes.SubNode.glslTemplate({});
      expect(code).toBe('(0.0 - 0.0)');
    });
  });

  describe('MultNode', () => {
    it('should generate multiplication GLSL code', () => {
      const code = MathNodes.MultNode.glslTemplate({ a: '3.0', b: '4.0' });
      expect(code).toBe('(3.0 * 4.0)');
    });

    it('should default to 1.0 for multiplication', () => {
      const code = MathNodes.MultNode.glslTemplate({});
      expect(code).toBe('(1.0 * 1.0)');
    });
  });

  describe('DivNode', () => {
    it('should generate division GLSL code', () => {
      const code = MathNodes.DivNode.glslTemplate({ a: '8.0', b: '2.0' });
      expect(code).toBe('(8.0 / 2.0)');
    });

    it('should default to 1.0 for division', () => {
      const code = MathNodes.DivNode.glslTemplate({});
      expect(code).toBe('(1.0 / 1.0)');
    });
  });

  describe('SinNode', () => {
    it('should generate sine GLSL code', () => {
      const code = MathNodes.SinNode.glslTemplate({ in: '3.14159' });
      expect(code).toBe('sin(3.14159)');
    });

    it('should handle missing input', () => {
      const code = MathNodes.SinNode.glslTemplate({});
      expect(code).toBe('sin(0.0)');
    });
  });

  describe('CosNode', () => {
    it('should generate cosine GLSL code', () => {
      const code = MathNodes.CosNode.glslTemplate({ in: '0.0' });
      expect(code).toBe('cos(0.0)');
    });

    it('should handle missing input', () => {
      const code = MathNodes.CosNode.glslTemplate({});
      expect(code).toBe('cos(0.0)');
    });
  });

  describe('AbsNode', () => {
    it('should generate absolute value GLSL code', () => {
      const code = MathNodes.AbsNode.glslTemplate({ in: '-5.0' });
      expect(code).toBe('abs(-5.0)');
    });

    it('should handle missing input', () => {
      const code = MathNodes.AbsNode.glslTemplate({});
      expect(code).toBe('abs(0.0)');
    });
  });

  describe('ExpNode', () => {
    it('should generate exponential GLSL code', () => {
      const code = MathNodes.ExpNode.glslTemplate({ in: '2.0' });
      expect(code).toBe('exp(2.0)');
    });

    it('should handle missing input', () => {
      const code = MathNodes.ExpNode.glslTemplate({});
      expect(code).toBe('exp(0.0)');
    });
  });

  describe('PowNode', () => {
    it('should generate power GLSL code', () => {
      const code = MathNodes.PowNode.glslTemplate({ base: '2.0', exp: '3.0' });
      expect(code).toBe('pow(2.0, 3.0)');
    });

    it('should handle missing inputs', () => {
      const code = MathNodes.PowNode.glslTemplate({});
      expect(code).toBe('pow(0.0, 1.0)');
    });

    it('should have two inputs', () => {
      expect(MathNodes.PowNode.inputs).toHaveLength(2);
      expect(MathNodes.PowNode.inputs[0].id).toBe('base');
      expect(MathNodes.PowNode.inputs[1].id).toBe('exp');
    });
  });

  describe('StepNode', () => {
    it('should generate a GLSL hard threshold with Edge before X', () => {
      const code = MathNodes.StepNode.glslTemplate({ edge: '0.25', x: 'value' });
      expect(code).toBe('step(0.25, value)');
    });

    it('should default to a useful 0.5 threshold and zero input', () => {
      const code = MathNodes.StepNode.glslTemplate({});
      expect(code).toBe('step(0.5, 0.0)');
    });

    it('should expose two strictly typed float inputs and one float output', () => {
      expect(MathNodes.StepNode.inputs.map(input => [input.id, input.type])).toEqual([
        ['edge', 'float'],
        ['x', 'float'],
      ]);
      expect(MathNodes.StepNode.outputs).toEqual([{ id: 'out', label: 'Step', type: 'float' }]);
    });
  });

  describe('scalar GLSL range builtins', () => {
    it('should generate min and max calls', () => {
      expect(MathNodes.MinNode.glslTemplate({ a: 'left', b: 'right' })).toBe('min(left, right)');
      expect(MathNodes.MaxNode.glslTemplate({ a: 'left', b: 'right' })).toBe('max(left, right)');
    });

    it('should generate clamp with X, Min and Max in GLSL order', () => {
      expect(MathNodes.ClampNode.glslTemplate({ x: 'value', min: '-1.0', max: '1.0' }))
        .toBe('clamp(value, -1.0, 1.0)');
      expect(MathNodes.ClampNode.glslTemplate({})).toBe('clamp(0.0, 0.0, 1.0)');
    });

    it('should generate scalar mix and useful defaults', () => {
      expect(MathNodes.MixFloatNode.glslTemplate({ a: 'low', b: 'high', t: 'factor' }))
        .toBe('mix(low, high, factor)');
      expect(MathNodes.MixFloatNode.glslTemplate({})).toBe('mix(0.0, 1.0, 0.5)');
    });

    it('should keep every scalar builtin strictly float typed', () => {
      [MathNodes.MinNode, MathNodes.MaxNode, MathNodes.ClampNode, MathNodes.MixFloatNode]
        .forEach(node => {
          expect(node.inputs.every(input => input.type === 'float')).toBe(true);
          expect(node.outputs[0].type).toBe('float');
        });
    });
  });

  describe('ColorAddNode', () => {
    it('should generate color addition GLSL code', () => {
      const code = MathNodes.ColorAddNode.glslTemplate({ 
        a: 'vec3(1.0, 0.0, 0.0)', 
        b: 'vec3(0.0, 1.0, 0.0)' 
      });
      expect(code).toBe('(vec3(1.0, 0.0, 0.0) + vec3(0.0, 1.0, 0.0))');
    });

    it('should handle missing inputs with vec3 defaults', () => {
      const code = MathNodes.ColorAddNode.glslTemplate({});
      expect(code).toBe('(vec3(0.0) + vec3(0.0))');
    });

    it('should have vec3 inputs and outputs', () => {
      expect(MathNodes.ColorAddNode.inputs[0].type).toBe('vec3');
      expect(MathNodes.ColorAddNode.inputs[1].type).toBe('vec3');
      expect(MathNodes.ColorAddNode.outputs[0].type).toBe('vec3');
    });
  });

  describe('ColorMultNode', () => {
    it('should generate color multiplication GLSL code', () => {
      const code = MathNodes.ColorMultNode.glslTemplate({ 
        col: 'vec3(1.0, 0.5, 0.0)', 
        fac: '0.5' 
      });
      expect(code).toBe('(vec3(1.0, 0.5, 0.0) * 0.5)');
    });

    it('should handle missing inputs', () => {
      const code = MathNodes.ColorMultNode.glslTemplate({});
      expect(code).toBe('(vec3(1.0) * 1.0)');
    });

    it('should have vec3 and float inputs', () => {
      expect(MathNodes.ColorMultNode.inputs[0].type).toBe('vec3');
      expect(MathNodes.ColorMultNode.inputs[1].type).toBe('float');
      expect(MathNodes.ColorMultNode.outputs[0].type).toBe('vec3');
    });
  });

  describe('All Math Nodes Structure', () => {
    const mathNodes = [
      MathNodes.AddNode,
      MathNodes.SubNode,
      MathNodes.MultNode,
      MathNodes.DivNode,
      MathNodes.SinNode,
      MathNodes.CosNode,
      MathNodes.AbsNode,
      MathNodes.ExpNode,
      MathNodes.PowNode,
      MathNodes.StepNode,
      MathNodes.MinNode,
      MathNodes.MaxNode,
      MathNodes.ClampNode,
      MathNodes.MixFloatNode,
      MathNodes.ColorAddNode,
      MathNodes.ColorMultNode
    ];

    it('should all have unique IDs', () => {
      const ids = mathNodes.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have labels', () => {
      mathNodes.forEach(node => {
        expect(node.label).toBeDefined();
        expect(node.label.length).toBeGreaterThan(0);
      });
    });

    it('should all have glslTemplate function', () => {
      mathNodes.forEach(node => {
        expect(typeof node.glslTemplate).toBe('function');
      });
    });

    it('should all have at least one output', () => {
      mathNodes.forEach(node => {
        expect(node.outputs.length).toBeGreaterThan(0);
      });
    });
  });
});
