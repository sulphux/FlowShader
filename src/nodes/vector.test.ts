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
    it('should generate UV shift code', () => {
      const code = VectorNodes.UVShiftNode.glslTemplate({ 
        uv: 'uv', 
        shift: '0.5' 
      });
      expect(code).toBe('(uv - 0.5)');
    });

    it('should handle missing inputs', () => {
      const code = VectorNodes.UVShiftNode.glslTemplate({});
      expect(code).toBe('(vec2(0.0) - 0.0)');
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
