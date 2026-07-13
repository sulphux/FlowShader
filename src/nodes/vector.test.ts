import { describe, it, expect } from 'vitest';
import * as VectorNodes from './vector';

describe('vector nodes', () => {
  describe('UVNode', () => {
    it('should generate UV coordinate code', () => {
      const code = VectorNodes.UVNode.glslTemplate({});
      expect(code).toBe('uv');
    });

    it('should have no inputs', () => {
      expect(VectorNodes.UVNode.inputs).toHaveLength(0);
    });

    it('should have vec2 output', () => {
      expect(VectorNodes.UVNode.outputs).toHaveLength(1);
      expect(VectorNodes.UVNode.outputs[0].type).toBe('vec2');
    });

    it('should be compact', () => {
      expect(VectorNodes.UVNode.compact).toBe(true);
    });
  });

  describe('LengthNode', () => {
    it('should generate length function code', () => {
      const code = VectorNodes.LengthNode.glslTemplate({ in: 'vec2(3.0, 4.0)' });
      expect(code).toBe('length(vec2(3.0, 4.0))');
    });

    it('should handle missing input', () => {
      const code = VectorNodes.LengthNode.glslTemplate({});
      expect(code).toBe('length(vec2(0.0))');
    });

    it('should have vec2 input and float output', () => {
      expect(VectorNodes.LengthNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.LengthNode.outputs[0].type).toBe('float');
    });
  });

  describe('LengthVec3Node', () => {
    it('should generate Vec3 length code and a typed zero default', () => {
      expect(VectorNodes.LengthVec3Node.glslTemplate({ in: 'position' })).toBe('length(position)');
      expect(VectorNodes.LengthVec3Node.glslTemplate({})).toBe('length(vec3(0.0))');
    });

    it('should convert vec3 to float', () => {
      expect(VectorNodes.LengthVec3Node.inputs[0].type).toBe('vec3');
      expect(VectorNodes.LengthVec3Node.outputs[0].type).toBe('float');
    });
  });

  describe('NormalizeVec3Node', () => {
    it('should generate Vec3 normalize code with a safe non-zero default', () => {
      expect(VectorNodes.NormalizeVec3Node.glslTemplate({ in: 'ray' })).toBe('normalize(ray)');
      expect(VectorNodes.NormalizeVec3Node.glslTemplate({})).toBe('normalize(vec3(0.0, 0.0, 1.0))');
    });

    it('should preserve vec3 type', () => {
      expect(VectorNodes.NormalizeVec3Node.inputs[0].type).toBe('vec3');
      expect(VectorNodes.NormalizeVec3Node.outputs[0].type).toBe('vec3');
    });
  });

  describe('vector geometry builtins', () => {
    it('normalizes Vec2 with a safe non-zero default', () => {
      expect(VectorNodes.NormalizeVec2Node.glslTemplate({ in: 'direction' })).toBe('normalize(direction)');
      expect(VectorNodes.NormalizeVec2Node.glslTemplate({})).toBe('normalize(vec2(1.0, 0.0))');
      expect(VectorNodes.NormalizeVec2Node.inputs[0].type).toBe('vec2');
      expect(VectorNodes.NormalizeVec2Node.outputs[0].type).toBe('vec2');
    });

    const scalarGeometryCases = [
      [VectorNodes.DotVec2Node, 'dot(a, b)', 'dot(vec2(0.0), vec2(0.0))', 'vec2'],
      [VectorNodes.DotVec3Node, 'dot(a, b)', 'dot(vec3(0.0), vec3(0.0))', 'vec3'],
      [VectorNodes.DistanceVec2Node, 'distance(a, b)', 'distance(vec2(0.0), vec2(0.0))', 'vec2'],
      [VectorNodes.DistanceVec3Node, 'distance(a, b)', 'distance(vec3(0.0), vec3(0.0))', 'vec3'],
    ] as const;

    it.each(scalarGeometryCases)('%s generates a scalar geometry expression', (node, expression, fallback, inputType) => {
      expect(node.glslTemplate({ a: 'a', b: 'b' })).toBe(expression);
      expect(node.glslTemplate({})).toBe(fallback);
      expect(node.inputs.every(input => input.type === inputType)).toBe(true);
      expect(node.outputs[0].type).toBe('float');
    });

    it('generates cross, reflect, refract, and faceforward expressions', () => {
      expect(VectorNodes.CrossVec3Node.glslTemplate({ a: 'a', b: 'b' })).toBe('cross(a, b)');
      expect(VectorNodes.ReflectVec3Node.glslTemplate({ incident: 'i', normal: 'n' })).toBe('reflect(i, n)');
      expect(VectorNodes.RefractVec3Node.glslTemplate({ incident: 'i', normal: 'n', eta: 'eta' }))
        .toBe('refract(i, n, eta)');
      expect(VectorNodes.FaceForwardVec3Node.glslTemplate({ normal: 'n', incident: 'i', reference: 'r' }))
        .toBe('faceforward(n, i, r)');
      [VectorNodes.CrossVec3Node, VectorNodes.ReflectVec3Node, VectorNodes.RefractVec3Node, VectorNodes.FaceForwardVec3Node]
        .forEach(node => expect(node.outputs[0].type).toBe('vec3'));
      expect(VectorNodes.RefractVec3Node.inputs.map(input => input.type)).toEqual(['vec3', 'vec3', 'float']);
    });
  });

  describe('strict Vec2 and Vec3 arithmetic', () => {
    const vectorCases = [
      [VectorNodes.AddVec2Node, { a: 'a', b: 'b' }, '(a + b)', '(vec2(0.0) + vec2(0.0))', 'vec2'],
      [VectorNodes.SubVec2Node, { a: 'a', b: 'b' }, '(a - b)', '(vec2(0.0) - vec2(0.0))', 'vec2'],
      [VectorNodes.MultiplyVec2Node, { a: 'a', b: 'b' }, '(a * b)', '(vec2(0.0) * vec2(1.0))', 'vec2'],
      [VectorNodes.ScaleVec2Node, { vector: 'v', factor: 'f' }, '(v * f)', '(vec2(0.0) * 1.0)', 'vec2'],
      [VectorNodes.DivideVec2Node, { vector: 'v', divisor: 'd' }, '(v / d)', '(vec2(0.0) / 1.0)', 'vec2'],
      [VectorNodes.AddVec3Node, { a: 'a', b: 'b' }, '(a + b)', '(vec3(0.0) + vec3(0.0))', 'vec3'],
      [VectorNodes.SubVec3Node, { a: 'a', b: 'b' }, '(a - b)', '(vec3(0.0) - vec3(0.0))', 'vec3'],
      [VectorNodes.MultiplyVec3Node, { a: 'a', b: 'b' }, '(a * b)', '(vec3(0.0) * vec3(1.0))', 'vec3'],
      [VectorNodes.ScaleVec3Node, { vector: 'v', factor: 'f' }, '(v * f)', '(vec3(0.0) * 1.0)', 'vec3'],
      [VectorNodes.DivideVec3Node, { vector: 'v', divisor: 'd' }, '(v / d)', '(vec3(0.0) / 1.0)', 'vec3'],
    ] as const;

    it.each(vectorCases)('%s emits the expected typed operator', (node, inputs, expression, fallback, type) => {
      expect(node.glslTemplate(inputs)).toBe(expression);
      expect(node.glslTemplate({})).toBe(fallback);
      expect(node.outputs[0].type).toBe(type);
      expect(node.inputs[0].type).toBe(type);
    });

    it('uses scalar second inputs only for scale and divide', () => {
      [VectorNodes.ScaleVec2Node, VectorNodes.DivideVec2Node, VectorNodes.ScaleVec3Node, VectorNodes.DivideVec3Node]
        .forEach(node => expect(node.inputs[1].type).toBe('float'));
    });
  });

  describe('FractNode', () => {
    it('should generate fract function code', () => {
      const code = VectorNodes.FractNode.glslTemplate({ in: 'uv * 10.0' });
      expect(code).toBe('fract(uv * 10.0)');
    });

    it('should handle missing input', () => {
      const code = VectorNodes.FractNode.glslTemplate({});
      expect(code).toBe('fract(vec2(0.0))');
    });

    it('should have vec2 input and output', () => {
      expect(VectorNodes.FractNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.FractNode.outputs[0].type).toBe('vec2');
    });
  });

  describe('UVScaleNode', () => {
    it('should generate UV scaling code', () => {
      const code = VectorNodes.UVScaleNode.glslTemplate({ 
        uv: 'uv', 
        scale: '2.0' 
      });
      expect(code).toBe('(uv * 2.0)');
    });

    it('should handle missing inputs', () => {
      const code = VectorNodes.UVScaleNode.glslTemplate({});
      expect(code).toBe('(vec2(0.0) * 1.0)');
    });

    it('should have vec2 and float inputs', () => {
      expect(VectorNodes.UVScaleNode.inputs).toHaveLength(2);
      expect(VectorNodes.UVScaleNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.UVScaleNode.inputs[1].type).toBe('float');
    });

    it('should output vec2', () => {
      expect(VectorNodes.UVScaleNode.outputs[0].type).toBe('vec2');
    });
  });

  describe('UVShiftNode', () => {
    it('should generate UV shift code with vec2 expansion', () => {
      const code = VectorNodes.UVShiftNode.glslTemplate({ 
        uv: 'uv', 
        shift: '0.5' 
      });
      expect(code).toBe('(uv - vec2(0.5))');
    });

    it('should handle missing inputs', () => {
      const code = VectorNodes.UVShiftNode.glslTemplate({});
      expect(code).toBe('(vec2(0.0) - vec2(0.0))');
    });

    it('should have vec2 and float inputs', () => {
      expect(VectorNodes.UVShiftNode.inputs).toHaveLength(2);
      expect(VectorNodes.UVShiftNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.UVShiftNode.inputs[1].type).toBe('float');
    });

    it('should output vec2', () => {
      expect(VectorNodes.UVShiftNode.outputs[0].type).toBe('vec2');
    });
  });

  describe('All Vector Nodes Structure', () => {
    const vectorNodes = [
      VectorNodes.UVNode,
      VectorNodes.LengthNode,
      VectorNodes.LengthVec3Node,
      VectorNodes.NormalizeVec2Node,
      VectorNodes.NormalizeVec3Node,
      VectorNodes.DotVec2Node,
      VectorNodes.DotVec3Node,
      VectorNodes.DistanceVec2Node,
      VectorNodes.DistanceVec3Node,
      VectorNodes.CrossVec3Node,
      VectorNodes.ReflectVec3Node,
      VectorNodes.RefractVec3Node,
      VectorNodes.FaceForwardVec3Node,
      VectorNodes.AddVec2Node,
      VectorNodes.SubVec2Node,
      VectorNodes.MultiplyVec2Node,
      VectorNodes.ScaleVec2Node,
      VectorNodes.DivideVec2Node,
      VectorNodes.AddVec3Node,
      VectorNodes.SubVec3Node,
      VectorNodes.MultiplyVec3Node,
      VectorNodes.ScaleVec3Node,
      VectorNodes.DivideVec3Node,
      VectorNodes.FractNode,
      VectorNodes.UVScaleNode,
      VectorNodes.UVShiftNode
    ];

    it('should all have unique IDs', () => {
      const ids = vectorNodes.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have labels', () => {
      vectorNodes.forEach(node => {
        expect(node.label).toBeDefined();
        expect(node.label.length).toBeGreaterThan(0);
      });
    });

    it('should all have glslTemplate function', () => {
      vectorNodes.forEach(node => {
        expect(typeof node.glslTemplate).toBe('function');
      });
    });

    it('should all be compact', () => {
      vectorNodes.forEach(node => {
        expect(node.compact).toBe(true);
      });
    });

    it('should all have at least one output', () => {
      vectorNodes.forEach(node => {
        expect(node.outputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Vector Node Type Consistency', () => {
    it('UVNode should output vec2', () => {
      expect(VectorNodes.UVNode.outputs[0].type).toBe('vec2');
    });

    it('LengthNode should convert vec2 to float', () => {
      expect(VectorNodes.LengthNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.LengthNode.outputs[0].type).toBe('float');
    });

    it('LengthVec3Node should convert vec3 to float', () => {
      expect(VectorNodes.LengthVec3Node.inputs[0].type).toBe('vec3');
      expect(VectorNodes.LengthVec3Node.outputs[0].type).toBe('float');
    });

    it('NormalizeVec3Node should preserve vec3', () => {
      expect(VectorNodes.NormalizeVec3Node.inputs[0].type).toBe('vec3');
      expect(VectorNodes.NormalizeVec3Node.outputs[0].type).toBe('vec3');
    });

    it('FractNode should preserve vec2 type', () => {
      expect(VectorNodes.FractNode.inputs[0].type).toBe('vec2');
      expect(VectorNodes.FractNode.outputs[0].type).toBe('vec2');
    });

    it('UVScaleNode should preserve vec2 output', () => {
      expect(VectorNodes.UVScaleNode.outputs[0].type).toBe('vec2');
    });

    it('UVShiftNode should preserve vec2 output', () => {
      expect(VectorNodes.UVShiftNode.outputs[0].type).toBe('vec2');
    });
  });
});
