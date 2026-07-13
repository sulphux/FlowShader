import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { rehydrateGraph, serializeGraph, type SerializedGraph } from './graphRehydration';
import { resolveFrameBufferMode } from './frameBufferMode';

describe('Frame Buffer mode migration and persistence', () => {
  it('infers legacy mode from the old Snapshot connection convention', () => {
    const node = { id: 'buffer1', data: {} };
    expect(resolveFrameBufferMode(node, [])).toBe('last-frame');
    expect(resolveFrameBufferMode(node, [{ target: 'buffer1', targetHandle: 'impulse' }])).toBe('snapshot');
  });

  it('prefers an explicit mode even when Snapshot is still connected', () => {
    const node = { id: 'buffer1', data: { captureMode: 'last-frame' } };
    expect(resolveFrameBufferMode(node, [{ target: 'buffer1', targetHandle: 'impulse' }]))
      .toBe('last-frame');
  });

  it('migrates old saved buffers to an explicit mode on load', () => {
    const parsed = {
      nodes: [
        { id: 'impulse1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { id: 'impulse' } } },
        { id: 'buffer1', type: 'shaderNode', position: { x: 100, y: 0 }, data: { definition: { id: 'feedback' } } },
        { id: 'buffer2', type: 'shaderNode', position: { x: 200, y: 0 }, data: { definition: { id: 'feedback' } } },
      ],
      edges: [
        { id: 'snapshot-edge', source: 'impulse1', sourceHandle: 'out', target: 'buffer1', targetHandle: 'impulse' },
      ],
    } as SerializedGraph;

    const restored = rehydrateGraph(parsed);
    expect(restored.nodes.find(node => node.id === 'buffer1')?.data.captureMode).toBe('snapshot');
    expect(restored.nodes.find(node => node.id === 'buffer2')?.data.captureMode).toBe('last-frame');
  });

  it('round-trips an explicit mode through graph serialization', () => {
    const nodes: Node[] = [{
      id: 'buffer1', type: 'shaderNode', position: { x: 0, y: 0 },
      data: { definition: NODE_REGISTRY.feedback, captureMode: 'last-frame' },
    }];
    const serialized = serializeGraph(nodes, [] as Edge[]);
    expect(serialized.nodes[0].data.captureMode).toBe('last-frame');
    expect(rehydrateGraph(JSON.parse(JSON.stringify(serialized))).nodes[0].data.captureMode).toBe('last-frame');
  });
});
