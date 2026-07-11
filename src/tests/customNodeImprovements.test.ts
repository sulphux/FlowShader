import { describe, it, expect, beforeEach } from 'vitest';
import { computeSmartSplitPorts, SMART_SPLIT_TYPE_CYCLE } from '../core/smartSplitAdapter';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';

describe('computeSmartSplitPorts (shared adapter, dedup of 3 previously-independent copies)', () => {
  it('produces X/Y for vec2', () => {
    expect(computeSmartSplitPorts('vec2')).toEqual({
      inputLabel: 'Vec2',
      outputs: [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }],
    });
  });

  it('produces R/G/B for vec3', () => {
    const result = computeSmartSplitPorts('vec3');
    expect(result.outputs.map(o => o.id)).toEqual(['x', 'y', 'z']);
    expect(result.outputs.map(o => o.label)).toEqual(['R', 'G', 'B']);
  });

  it('produces R/G/B/A for vec4', () => {
    const result = computeSmartSplitPorts('vec4');
    expect(result.outputs.map(o => o.id)).toEqual(['x', 'y', 'z', 'w']);
    expect(result.outputs.map(o => o.label)).toEqual(['R', 'G', 'B', 'A']);
  });

  it('produces a single Value output for float', () => {
    expect(computeSmartSplitPorts('float')).toEqual({
      inputLabel: 'Float',
      outputs: [{ id: 'x', label: 'Value', type: 'float' }],
    });
  });

  it('falls back to an undetermined auto placeholder for unknown/auto types', () => {
    expect(computeSmartSplitPorts('auto').outputs).toEqual([{ id: 'auto', label: 'Auto', type: 'auto' }]);
  });

  it('cycle order starts at float (so clicking from "auto" lands on float first)', () => {
    expect(SMART_SPLIT_TYPE_CYCLE[0]).toBe('float');
    expect(SMART_SPLIT_TYPE_CYCLE).toHaveLength(4);
  });
});

describe('Split (Auto) forced type survives a save -> load roundtrip', () => {
  const buildGraph = (): { nodes: Node[]; edges: Edge[] } => ({
    nodes: [
      { id: 'uv1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY.uv } },
      {
        id: 'split1', type: 'shaderNode', position: { x: 200, y: 0 },
        data: {
          definition: NODE_REGISTRY.smart_split,
          forcedType: 'vec4', // user forced vec4 even though only a vec2 is connected
        }
      },
    ],
    edges: [{ id: 'e1', source: 'uv1', sourceHandle: 'out', target: 'split1', targetHandle: 'in' }],
  });

  it('a forced type is NOT overwritten by the connected edge on rehydrate', () => {
    const graph = buildGraph();
    // Simulate what the badge click already does: apply the forced ports up front
    const adapted = computeSmartSplitPorts('vec4');
    graph.nodes[1] = {
      ...graph.nodes[1],
      data: { ...graph.nodes[1].data, definition: { ...NODE_REGISTRY.smart_split, inputs: [{ id: 'in', label: adapted.inputLabel, type: 'vec4' }], outputs: adapted.outputs } },
    };

    const serialized = serializeGraph(graph.nodes, graph.edges);
    const restored = rehydrateGraph(JSON.parse(JSON.stringify(serialized)));

    const split = restored.nodes.find(n => n.id === 'split1')!;
    // vec4 (forced), not vec2 (what the connected UV node would have implied)
    expect(split.data.definition.inputs[0].type).toBe('vec4');
    expect(split.data.definition.outputs.map((o: { id: string }) => o.id)).toEqual(['x', 'y', 'z', 'w']);
  });
});
