import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

const glslangAvailable = hasGlslangValidator();

describe('New nodes', () => {
  it('mono fills RGB from a single float', () => {
    expect(NODE_REGISTRY.mono.glslTemplate({ in: '0.7' })).toBe('vec3(0.7)');
  });

  it('math_fract wraps input in fract()', () => {
    expect(NODE_REGISTRY.math_fract.glslTemplate({ in: 'x' })).toBe('fract(x)');
  });

  it('math_step applies a hard threshold and compiles in a float graph', () => {
    expect(NODE_REGISTRY.math_step.glslTemplate({ edge: '0.5', x: 'x' })).toBe('step(0.5, x)');

    const nodes: GraphNode[] = [
      { id: 'time1', type: 'shaderNode', data: { definition: NODE_REGISTRY.time } },
      { id: 'step1', type: 'shaderNode', data: { definition: NODE_REGISTRY.math_step } },
      { id: 'mono1', type: 'shaderNode', data: { definition: NODE_REGISTRY.mono } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const edges = [
      { source: 'time1', sourceHandle: 't', target: 'step1', targetHandle: 'x' },
      { source: 'step1', sourceHandle: 'out', target: 'mono1', targetHandle: 'in' },
      { source: 'mono1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ];
    const shader = compileGraphToGLSL(nodes, edges);

    expect(shader).toContain('step(0.5, var_time1)');
    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, `glslang rejected:\n${result.output}\n${shader}`).toBe(true);
    }
  });

  it('trig nodes generate expected GLSL', () => {
    expect(NODE_REGISTRY.math_tan.glslTemplate({ in: 'x' })).toBe('tan(x)');
    expect(NODE_REGISTRY.math_cot.glslTemplate({ in: 'x' })).toBe('(cos(x) / sin(x))');
    expect(NODE_REGISTRY.math_atan.glslTemplate({ in: 'x' })).toBe('atan(x)');
  });

  it('color_preview compiles as a target without emitting an empty variable', () => {
    // Regresja: pusty glslTemplate emitował "vec3 var_x = ;" → błąd składni GLSL
    // i czarny swatch w Color Preview
    const nodes: GraphNode[] = [
      { id: 'col1', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_color, value: '#ff007a' } },
      { id: 'cprev1', type: 'colorPreviewNode', data: { definition: NODE_REGISTRY.color_preview } },
    ];
    const edges = [
      { source: 'col1', sourceHandle: 'rgb', target: 'cprev1', targetHandle: 'in' },
    ];

    const shader = compileGraphToGLSL(nodes, edges, 'cprev1');
    expect(shader).not.toMatch(/=\s*;/);
    expect(shader).toContain('gl_FragColor = vec4(var_col1, 1.0);');

    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, `glslang rejected:\n${result.output}\n${shader}`).toBe(true);
    }
  });

  describe('code_glsl', () => {
    const codeDef = NODE_REGISTRY.code_glsl;

    it('substitutes whole-word input identifiers a-d', () => {
      const result = codeDef.glslTemplate(
        { a: 'var_x', b: 'var_y' },
        { value: 'a + b * abs(a)', definition: codeDef }
      );
      // 'a'/'b' podstawione, ale 'abs' nietknięte (całe słowa)
      expect(result).toBe('(var_x + var_y * abs(var_x))');
    });

    it('uses 0.0 for unconnected inputs', () => {
      const result = codeDef.glslTemplate({}, { value: 'a + c', definition: codeDef });
      expect(result).toBe('(0.0 + 0.0)');
    });

    it('falls back to typed zero when expression is empty', () => {
      const vec3Def = { ...codeDef, outputs: [{ id: 'out', label: 'Out', type: 'vec3' }] };
      expect(codeDef.glslTemplate({}, { value: '', definition: vec3Def })).toBe('vec3(0.0)');
      expect(codeDef.glslTemplate({}, { value: '', definition: codeDef })).toBe('0.0');
    });

    it('compiles a full graph with a code node to valid GLSL', () => {
      const nodes: GraphNode[] = [
        { id: 'time1', type: 'shaderNode', data: { definition: NODE_REGISTRY.time } },
        {
          id: 'code1',
          type: 'shaderNode',
          data: {
            definition: { ...NODE_REGISTRY.code_glsl, outputs: [{ id: 'out', label: 'Out', type: 'vec3' }] },
            value: 'vec3(sin(a), cos(a), 0.5)',
          },
        },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
      ];
      const edges = [
        { source: 'time1', sourceHandle: 't', target: 'code1', targetHandle: 'a' },
        { source: 'code1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
      ];

      const shader = compileGraphToGLSL(nodes, edges);
      expect(shader).toContain('vec3(sin(');

      if (glslangAvailable) {
        const result = validateWithGlslangValidator(shader, 'frag');
        expect(result.ok, `glslang rejected:\n${result.output}\n${shader}`).toBe(true);
      }
    });
  });
});
