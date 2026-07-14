import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { inlinePortHandleId } from './inlinePortAdapters';
import { insertAutoAdapter } from './autoAdapterSystem';

const node = (id: string, definition: typeof NODE_REGISTRY.param_color, x = 0): Node => ({
  id,
  type: 'shaderNode',
  position: { x, y: 0 },
  data: { definition },
});

describe('inline auto adapters', () => {
  const time = node('time', NODE_REGISTRY.param_time as typeof NODE_REGISTRY.param_color);
  const color = node('color', NODE_REGISTRY.param_color, 400);
  const edges: Edge[] = [];

  it('expands a vec3 target and connects float to X without creating a node', () => {
    const result = insertAutoAdapter(
      [time, color], edges,
      { source: 'time', sourceHandle: 'value', target: 'color', targetHandle: 'color' },
      'float', 'vec3',
    );

    expect(result.newNodes).toEqual([]);
    expect(result.updatedNodes).toHaveLength(1);
    expect(result.updatedNodes[0].data.inlinePortExpansion.inputs).toEqual(['color']);
    expect(result.newEdges).toHaveLength(1);
    expect(result.newEdges[0]).toMatchObject({
      source: 'time', sourceHandle: 'value', target: 'color',
      targetHandle: inlinePortHandleId('input', 'color', 'x'),
    });
  });

  it('expands a vec3 source and connects X to a float target', () => {
    const result = insertAutoAdapter(
      [color, time], edges,
      { source: 'color', sourceHandle: 'rgb', target: 'time', targetHandle: 'dummy' },
      'vec3', 'float',
    );

    expect(result.newNodes).toEqual([]);
    expect(result.updatedNodes[0].data.inlinePortExpansion.outputs).toEqual(['rgb']);
    expect(result.newEdges[0]).toMatchObject({
      sourceHandle: inlinePortHandleId('output', 'rgb', 'x'),
      targetHandle: 'dummy',
    });
  });

  it('turns Color Param RGB into X/Y/Z and Add Vec2 A into X/Y inside the nodes', () => {
    const add = node('add', NODE_REGISTRY.vec_add2 as typeof NODE_REGISTRY.param_color, 400);
    const result = insertAutoAdapter(
      [color, add], edges,
      { source: 'color', sourceHandle: 'rgb', target: 'add', targetHandle: 'a' },
      'vec3', 'vec2',
    );

    expect(result.newNodes).toEqual([]);
    expect(result.updatedNodes).toHaveLength(2);
    expect(result.updatedNodes[0].data.inlinePortExpansion.outputs).toEqual(['rgb']);
    expect(result.updatedNodes[1].data.inlinePortExpansion.inputs).toEqual(['a']);
    expect(result.newEdges).toHaveLength(2);
    expect(result.newEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceHandle: inlinePortHandleId('output', 'rgb', 'x'),
        targetHandle: inlinePortHandleId('input', 'a', 'x'),
      }),
      expect.objectContaining({
        sourceHandle: inlinePortHandleId('output', 'rgb', 'y'),
        targetHandle: inlinePortHandleId('input', 'a', 'y'),
      }),
    ]));
  });

  it('maps only the common components when vector dimensions differ', () => {
    const uv = node('uv', NODE_REGISTRY.uv as typeof NODE_REGISTRY.param_color);
    const result = insertAutoAdapter(
      [uv, color], edges,
      { source: 'uv', sourceHandle: 'out', target: 'color', targetHandle: 'color' },
      'vec2', 'vec3',
    );

    expect(result.newNodes).toEqual([]);
    expect(result.newEdges).toHaveLength(2);
  });

  it('resolves a multi-type target to its vector option', () => {
    const uv = node('uv', NODE_REGISTRY.uv as typeof NODE_REGISTRY.param_color);
    const output = node('output', NODE_REGISTRY.output as typeof NODE_REGISTRY.param_color, 400);
    const result = insertAutoAdapter(
      [uv, output], edges,
      { source: 'uv', sourceHandle: 'out', target: 'output', targetHandle: 'color' },
      'vec2', 'float|vec3' as never,
    );

    expect(result.newNodes).toEqual([]);
    expect(result.updatedNodes).toHaveLength(2);
    expect(result.newEdges).toHaveLength(2);
  });

  it('does nothing for an exact type match', () => {
    const result = insertAutoAdapter(
      [time, color], edges,
      { source: 'time', sourceHandle: 'value', target: 'color', targetHandle: 'dummy' },
      'float', 'float',
    );
    expect(result).toEqual({ newNodes: [], updatedNodes: [], newEdges: [] });
  });

  it('does nothing when a multi-type target accepts the source exactly', () => {
    const result = insertAutoAdapter(
      [time, color], edges,
      { source: 'time', sourceHandle: 'value', target: 'color', targetHandle: 'dummy' },
      'float', 'float|vec3' as never,
    );
    expect(result).toEqual({ newNodes: [], updatedNodes: [], newEdges: [] });
  });

  it('fails safely when an endpoint is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = insertAutoAdapter(
      [time, color], edges,
      { source: 'missing', sourceHandle: 'value', target: 'color', targetHandle: 'color' },
      'float', 'vec3',
    );
    expect(result).toEqual({ newNodes: [], updatedNodes: [], newEdges: [] });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
