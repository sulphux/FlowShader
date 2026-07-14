import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { inferCodeExpressionType, reconcileDynamicPorts } from './dynamicPortSystem';

const node = (id: string, definition: keyof typeof NODE_REGISTRY, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'shaderNode',
  position: { x: 0, y: 0 },
  data: { definition: NODE_REGISTRY[definition], ...data },
});

describe('inferCodeExpressionType', () => {
  it.each([
    ['vec2(a, b)', 'vec2'],
    [' ( vec3(a) ) ', 'vec3'],
    ['vec4(a, b, c, d)', 'vec4'],
  ])('infers an unambiguous constructor %s', (expression, expected) => {
    expect(inferCodeExpressionType(expression)).toBe(expected);
  });

  it.each(['vec4(a).x', 'dot(vec4(a), vec4(b))', 'mix(a, b, c)'])('does not guess the result of %s', expression => {
    expect(inferCodeExpressionType(expression)).toBeUndefined();
  });
});

describe('reconcileDynamicPorts', () => {
  it('keeps Code, Auto Split and Auto Compose in sync regardless of saved auto ports', () => {
    const nodes = [
      node('code', 'code_glsl', { value: 'vec4(a, b, c, d)' }),
      node('split', 'smart_split', { forcedType: 'vec4' }),
      node('compose', 'smart_compose'),
      {
        ...node('custom-out', 'custom_output'),
        data: {
          definition: {
            ...NODE_REGISTRY.custom_output,
            inputs: [{ id: 'in', label: 'Value', type: 'vec2' }],
          },
          detectedType: 'vec2',
        },
      },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'code', sourceHandle: 'out', target: 'split', targetHandle: 'in' },
      { id: 'e2', source: 'split', sourceHandle: 'x', target: 'compose', targetHandle: 'x' },
      { id: 'e3', source: 'split', sourceHandle: 'y', target: 'compose', targetHandle: 'y' },
      { id: 'e4', source: 'compose', sourceHandle: 'out', target: 'custom-out', targetHandle: 'in' },
    ];

    const restored = reconcileDynamicPorts(nodes, edges);
    const typeOf = (id: string, direction: 'inputs' | 'outputs') =>
      restored.find(item => item.id === id)!.data.definition[direction];

    expect(typeOf('code', 'outputs')[0].type).toBe('vec4');
    expect(typeOf('split', 'outputs').map((port: { id: string }) => port.id)).toEqual(['x', 'y', 'z', 'w']);
    expect(typeOf('compose', 'outputs')[0].type).toBe('vec2');
    expect(typeOf('compose', 'inputs').map((port: { id: string }) => port.id)).toEqual(['x', 'y']);
  });
});
