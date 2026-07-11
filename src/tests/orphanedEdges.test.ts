import { describe, it, expect } from 'vitest';
import { rehydrateGraph } from '../core/graphRehydration';

/**
 * Regresja: deleteSelected() (NodeEditor.tsx) used to only remove edges that
 * were THEMSELVES selected, not edges connected to the node being deleted —
 * deleting a node left its edges behind, pointing at a node id that no
 * longer existed (found in a real user save, Examples/TESTOWO.json, which
 * had 3 edges referencing a split_vec3/combine_vec4 pair absent from the
 * node list). deleteSelected() now also drops edges touching removed nodes;
 * rehydrateGraph() additionally self-heals already-corrupted saves on load.
 */
describe('rehydrateGraph drops orphaned edges (dangling source/target)', () => {
  const baseNodes = [
    { id: 'a', data: { definition: { id: 'time' } } },
    { id: 'b', data: { definition: { id: 'output' } } },
  ];

  it('drops an edge whose source node no longer exists', () => {
    const parsed = {
      nodes: baseNodes,
      edges: [
        { id: 'e1', source: 'deleted_node', sourceHandle: 'out', target: 'b', targetHandle: 'color' },
        { id: 'e2', source: 'a', sourceHandle: 't', target: 'b', targetHandle: 'color' },
      ],
    };
    const { edges } = rehydrateGraph(parsed);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('e2');
  });

  it('drops an edge whose target node no longer exists', () => {
    const parsed = {
      nodes: baseNodes,
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 't', target: 'deleted_node', targetHandle: 'in' },
      ],
    };
    const { edges } = rehydrateGraph(parsed);
    expect(edges).toHaveLength(0);
  });

  it('keeps edges where both endpoints exist', () => {
    const parsed = {
      nodes: baseNodes,
      edges: [{ id: 'e1', source: 'a', sourceHandle: 't', target: 'b', targetHandle: 'color' }],
    };
    const { edges } = rehydrateGraph(parsed);
    expect(edges).toHaveLength(1);
  });

  it('the real TESTOWO.json (if present) has no orphaned edges left after rehydration', () => {
    // Exercised indirectly via graphLoadRegression.test.ts against the actual
    // file; this test documents the invariant using an inline reproduction
    // of the exact corruption found in that file (a split_vec3 -> combine_vec4
    // pair with edges but no matching nodes).
    const parsed = {
      nodes: [
        { id: 'uv1', data: { definition: { id: 'uv' } } },
        { id: 'out1', data: { definition: { id: 'output' } } },
      ],
      edges: [
        { id: 'e1', source: 'split_vec3_orphan', sourceHandle: 'x', target: 'combine_vec4_orphan', targetHandle: 'x' },
        { id: 'e2', source: 'split_vec3_orphan', sourceHandle: 'y', target: 'combine_vec4_orphan', targetHandle: 'y' },
        { id: 'e3', source: 'uv1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
      ],
    };
    const { edges, nodes } = rehydrateGraph(parsed);
    expect(nodes).toHaveLength(2);
    expect(edges).toEqual([{ id: 'e3', source: 'uv1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' }]);
  });
});
