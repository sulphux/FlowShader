import { describe, expect, it } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

const glslangAvailable = hasGlslangValidator();

const validateShader = (shader: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `glslang rejected:\n${result.output}\n${shader}`).toBe(true);
};

const graphNode = (id: string, definitionId: keyof typeof NODE_REGISTRY): GraphNode => ({
  id,
  type: 'shaderNode',
  data: { definition: NODE_REGISTRY[definitionId] },
});

describe('basic GLSL builtin graph compilation', () => {
  it('compiles the complete scalar package as GLSL ES 1.00', () => {
    const scalarChain = [
      ['floor', 'math_floor', 'in'],
      ['ceil', 'math_ceil', 'in'],
      ['round', 'math_round', 'in'],
      ['sign', 'math_sign', 'in'],
      ['sqrt', 'math_sqrt', 'in'],
      ['inversesqrt', 'math_inversesqrt', 'in'],
      ['asin', 'math_asin', 'in'],
      ['acos', 'math_acos', 'in'],
      ['log', 'math_log', 'in'],
      ['log2', 'math_log2', 'in'],
      ['exp2', 'math_exp2', 'in'],
      ['radians', 'math_radians', 'in'],
      ['degrees', 'math_degrees', 'in'],
      ['mod', 'math_mod', 'x'],
      ['atan2', 'math_atan2', 'y'],
      ['smoothstep', 'math_smoothstep', 'x'],
    ] as const;

    const nodes: GraphNode[] = [
      graphNode('time', 'time'),
      ...scalarChain.map(([id, definitionId]) => graphNode(id, definitionId)),
      graphNode('mono', 'mono'),
      graphNode('output', 'output'),
    ];
    const edges: Array<{ source: string; sourceHandle: string; target: string; targetHandle: string }> = [];
    let previousId = 'time';
    let previousHandle = 't';
    scalarChain.forEach(([id, , targetHandle]) => {
      edges.push({ source: previousId, sourceHandle: previousHandle, target: id, targetHandle });
      previousId = id;
      previousHandle = 'out';
    });
    edges.push(
      { source: previousId, sourceHandle: previousHandle, target: 'mono', targetHandle: 'in' },
      { source: 'mono', sourceHandle: 'out', target: 'output', targetHandle: 'color' },
    );

    const shader = compileGraphToGLSL(nodes, edges);
    [
      'floor(', 'ceil(', 'sign(', 'sqrt(', 'inversesqrt(', 'asin(', 'acos(',
      'log(', 'log2(', 'exp2(', 'radians(', 'degrees(', 'mod(', 'atan(', 'smoothstep(',
    ].forEach(call => expect(shader).toContain(call));
    expect(shader).toContain('floor(abs(');
    expect(shader).not.toContain('round(');
    validateShader(shader);
  });

  it('compiles strict Vec2 arithmetic and geometry in one graph', () => {
    const nodes: GraphNode[] = [
      graphNode('uv', 'uv'),
      graphNode('add2', 'vec_add2'),
      graphNode('sub2', 'vec_sub2'),
      graphNode('mult2', 'vec_mult2'),
      graphNode('scale2', 'vec_scale2'),
      graphNode('div2', 'vec_div2'),
      graphNode('normalize2', 'vec_normalize2'),
      graphNode('dot2', 'vec_dot2'),
      graphNode('distance2', 'vec_distance2'),
      graphNode('sum', 'math_add'),
      graphNode('mono', 'mono'),
      graphNode('output', 'output'),
    ];
    const edges = [
      { source: 'uv', sourceHandle: 'out', target: 'add2', targetHandle: 'a' },
      { source: 'add2', sourceHandle: 'out', target: 'sub2', targetHandle: 'a' },
      { source: 'sub2', sourceHandle: 'out', target: 'mult2', targetHandle: 'a' },
      { source: 'mult2', sourceHandle: 'out', target: 'scale2', targetHandle: 'vector' },
      { source: 'scale2', sourceHandle: 'out', target: 'div2', targetHandle: 'vector' },
      { source: 'div2', sourceHandle: 'out', target: 'normalize2', targetHandle: 'in' },
      { source: 'normalize2', sourceHandle: 'out', target: 'dot2', targetHandle: 'a' },
      { source: 'normalize2', sourceHandle: 'out', target: 'distance2', targetHandle: 'a' },
      { source: 'dot2', sourceHandle: 'out', target: 'sum', targetHandle: 'a' },
      { source: 'distance2', sourceHandle: 'out', target: 'sum', targetHandle: 'b' },
      { source: 'sum', sourceHandle: 'out', target: 'mono', targetHandle: 'in' },
      { source: 'mono', sourceHandle: 'out', target: 'output', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);
    ['normalize(', 'dot(', 'distance('].forEach(call => expect(shader).toContain(call));
    [' + ', ' - ', ' * ', ' / '].forEach(operator => expect(shader).toContain(operator));
    validateShader(shader);
  });

  it('compiles strict Vec3 arithmetic, lighting, and geometry in one graph', () => {
    const colorNode: GraphNode = {
      id: 'color',
      type: 'shaderNode',
      data: { definition: NODE_REGISTRY.param_color, value: '#4080ff' },
    };
    const nodes: GraphNode[] = [
      colorNode,
      graphNode('add3', 'vec_add3'),
      graphNode('sub3', 'vec_sub3'),
      graphNode('mult3', 'vec_mult3'),
      graphNode('scale3', 'vec_scale3'),
      graphNode('div3', 'vec_div3'),
      graphNode('normalize3', 'vec_normalize3'),
      graphNode('cross3', 'vec_cross3'),
      graphNode('reflect3', 'vec_reflect3'),
      graphNode('refract3', 'vec_refract3'),
      graphNode('faceforward3', 'vec_faceforward3'),
      graphNode('dot3', 'vec_dot3'),
      graphNode('distance3', 'vec_distance3'),
      graphNode('factor', 'math_add'),
      graphNode('finalScale', 'vec_scale3'),
      graphNode('output', 'output'),
    ];
    const edges = [
      { source: 'color', sourceHandle: 'rgb', target: 'add3', targetHandle: 'a' },
      { source: 'add3', sourceHandle: 'out', target: 'sub3', targetHandle: 'a' },
      { source: 'sub3', sourceHandle: 'out', target: 'mult3', targetHandle: 'a' },
      { source: 'mult3', sourceHandle: 'out', target: 'scale3', targetHandle: 'vector' },
      { source: 'scale3', sourceHandle: 'out', target: 'div3', targetHandle: 'vector' },
      { source: 'div3', sourceHandle: 'out', target: 'normalize3', targetHandle: 'in' },
      { source: 'normalize3', sourceHandle: 'out', target: 'cross3', targetHandle: 'a' },
      { source: 'cross3', sourceHandle: 'out', target: 'reflect3', targetHandle: 'incident' },
      { source: 'reflect3', sourceHandle: 'out', target: 'refract3', targetHandle: 'incident' },
      { source: 'refract3', sourceHandle: 'out', target: 'faceforward3', targetHandle: 'normal' },
      { source: 'faceforward3', sourceHandle: 'out', target: 'dot3', targetHandle: 'a' },
      { source: 'faceforward3', sourceHandle: 'out', target: 'distance3', targetHandle: 'a' },
      { source: 'dot3', sourceHandle: 'out', target: 'factor', targetHandle: 'a' },
      { source: 'distance3', sourceHandle: 'out', target: 'factor', targetHandle: 'b' },
      { source: 'faceforward3', sourceHandle: 'out', target: 'finalScale', targetHandle: 'vector' },
      { source: 'factor', sourceHandle: 'out', target: 'finalScale', targetHandle: 'factor' },
      { source: 'finalScale', sourceHandle: 'out', target: 'output', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);
    ['normalize(', 'cross(', 'reflect(', 'refract(', 'faceforward(', 'dot(', 'distance(']
      .forEach(call => expect(shader).toContain(call));
    [' + ', ' - ', ' * ', ' / '].forEach(operator => expect(shader).toContain(operator));
    validateShader(shader);
  });
});
