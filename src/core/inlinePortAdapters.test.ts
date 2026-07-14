import { describe, expect, it } from 'vitest';
import { inlineHandleType, inlinePortHandleId, parseInlinePortHandle, relatedInputHandles, vectorComponents } from './inlinePortAdapters';
import { NODE_REGISTRY } from '../nodes';
import { rehydrateGraph, serializeGraph, type SerializedGraph } from './graphRehydration';

describe('inline port adapters', () => {
  it('creates and parses stable component handle ids', () => {
    const id = inlinePortHandleId('output', 'color', 'z');
    expect(parseInlinePortHandle(id)).toEqual({ direction: 'output', portId: 'color', component: 'z' });
  });

  it('exposes only components that exist on the vector type', () => {
    expect(vectorComponents('vec2')).toEqual(['x', 'y']);
    expect(vectorComponents('float')).toEqual([]);
    expect(inlineHandleType(NODE_REGISTRY.uv, inlinePortHandleId('output', 'out', 'y'))).toBe('float');
    expect(inlineHandleType(NODE_REGISTRY.uv, inlinePortHandleId('output', 'out', 'z'))).toBeNull();
  });

  it('returns the parent and every component handle for exclusive input wiring', () => {
    expect(relatedInputHandles('color', 'vec3')).toEqual([
      'color',
      inlinePortHandleId('input', 'color', 'x'),
      inlinePortHandleId('input', 'color', 'y'),
      inlinePortHandleId('input', 'color', 'z'),
    ]);
  });

  it('persists expanded pins with the graph', () => {
    const saved = serializeGraph([{
      id: 'uv1', type: 'shaderNode', position: { x: 10, y: 20 },
      data: { definition: NODE_REGISTRY.uv, inlinePortExpansion: { outputs: ['out'] } },
    }], []);
    expect(saved.nodes[0].data.inlinePortExpansion).toEqual({ outputs: ['out'] });
    expect(rehydrateGraph(saved).nodes[0].data.inlinePortExpansion).toEqual({ outputs: ['out'] });
  });

  it('folds legacy generated Split/Combine nodes into their neighboring ports', () => {
    const graph = {
      nodes: [
        { id: 'color', position: { x: 0, y: 0 }, data: { definition: { id: 'param_color' } } },
        { id: 'split_vec3_adapter_old', position: { x: 100, y: 0 }, data: { definition: { id: 'split_vec3' } } },
        { id: 'combine_vec2_adapter_old', position: { x: 200, y: 0 }, data: { definition: { id: 'combine_vec2' } } },
        { id: 'add', position: { x: 300, y: 0 }, data: { definition: { id: 'vec_add2' } } },
      ],
      edges: [
        { id: 'source-split', source: 'color', sourceHandle: 'rgb', target: 'split_vec3_adapter_old', targetHandle: 'in' },
        { id: 'x', source: 'split_vec3_adapter_old', sourceHandle: 'x', target: 'combine_vec2_adapter_old', targetHandle: 'x' },
        { id: 'y', source: 'split_vec3_adapter_old', sourceHandle: 'y', target: 'combine_vec2_adapter_old', targetHandle: 'y' },
        { id: 'combine-target', source: 'combine_vec2_adapter_old', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
      ],
    } as SerializedGraph;

    const restored = rehydrateGraph(graph);
    expect(restored.nodes.map(node => node.id)).toEqual(['color', 'add']);
    expect(restored.nodes[0].data.inlinePortExpansion).toEqual({ outputs: ['rgb'] });
    expect(restored.nodes[1].data.inlinePortExpansion).toEqual({ inputs: ['a'] });
    expect(restored.edges).toHaveLength(2);
    expect(restored.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'color',
        sourceHandle: inlinePortHandleId('output', 'rgb', 'x'),
        target: 'add',
        targetHandle: inlinePortHandleId('input', 'a', 'x'),
      }),
      expect.objectContaining({
        sourceHandle: inlinePortHandleId('output', 'rgb', 'y'),
        targetHandle: inlinePortHandleId('input', 'a', 'y'),
      }),
    ]));
  });

  it('keeps Split/Combine nodes that the user added explicitly', () => {
    const graph = {
      nodes: [
        { id: 'manual-split', position: { x: 0, y: 0 }, data: { definition: { id: 'split_vec3' } } },
      ],
      edges: [],
    } as SerializedGraph;
    expect(rehydrateGraph(graph).nodes.map(node => node.id)).toEqual(['manual-split']);
  });
});
