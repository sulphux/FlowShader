import { describe, expect, it } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { inlinePortHandleId } from '../core/inlinePortAdapters';
import { NODE_REGISTRY } from '../nodes';
import type { ShaderNodeDefinition } from '../core/types';

const node = (id: string, definition: ShaderNodeDefinition, value?: unknown): GraphNode => ({
  id, type: 'shaderNode', data: { definition, value },
});

describe('inline Split/Combine compiler support', () => {
  it('reads a vector output component as a strict float source', () => {
    const nodes = [
      node('uv1', NODE_REGISTRY.uv),
      node('sin1', NODE_REGISTRY.math_sin),
      node('out1', NODE_REGISTRY.output),
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'uv1', sourceHandle: inlinePortHandleId('output', 'out', 'x'), target: 'sin1', targetHandle: 'in' },
      { source: 'sin1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ]);
    expect(shader).toContain('var_uv1.x');
    expect(shader).toContain('sin(var_uv1.x)');
  });

  it('builds a vector input from independently wired float components', () => {
    const passthrough: ShaderNodeDefinition = {
      id: 'test_vec3_passthrough', label: 'Vec3 Pass',
      inputs: [{ id: 'color', label: 'Color', type: 'vec3' }],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      glslTemplate: ({ color }) => color || 'vec3(0.0)',
    };
    const nodes = [
      node('r', NODE_REGISTRY.input_float, 0.25),
      node('g', NODE_REGISTRY.input_float, 0.75),
      node('pass', passthrough),
      node('out1', NODE_REGISTRY.output),
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'r', sourceHandle: 'out', target: 'pass', targetHandle: inlinePortHandleId('input', 'color', 'x') },
      { source: 'g', sourceHandle: 'out', target: 'pass', targetHandle: inlinePortHandleId('input', 'color', 'y') },
      { source: 'pass', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ]);
    expect(shader).toMatch(/vec3\(var_r, var_g, 0\.0\)/);
  });
});
