import { describe, expect, it } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { validateConnection } from '../core/connectionValidator';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';

describe('semantic impulse graph type', () => {
  it('is distinct from float while Frame Buffer Snapshot accepts both intentionally', () => {
    expect(NODE_REGISTRY.impulse.outputs[0].type).toBe('impulse');
    expect(NODE_REGISTRY.feedback.inputs[1].type).toBe('impulse|float');
    expect(validateConnection('impulse', 'float').valid).toBe(false);
    expect(validateConnection('float', 'impulse').valid).toBe(false);
    expect(validateConnection('impulse', NODE_REGISTRY.feedback.inputs[1].type).valid).toBe(true);
    expect(validateConnection('float', NODE_REGISTRY.feedback.inputs[1].type).valid).toBe(true);
  });

  it('still emits legal scalar GLSL instead of an invented GLSL type', () => {
    const nodes: GraphNode[] = [
      { id: 'imp', type: 'shaderNode', data: { definition: NODE_REGISTRY.impulse } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'imp', sourceHandle: 'out', target: 'out', targetHandle: 'color' },
    ]);
    expect(shader).toContain('float var_imp');
    expect(shader).not.toMatch(/\bimpulse\s+var_/);
  });

  it('upgrades old saved impulse edges to the event-aware renderer', () => {
    const restored = rehydrateGraph({
      nodes: [
        { id: 'imp', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { id: 'impulse' } } },
        { id: 'fb', type: 'shaderNode', position: { x: 200, y: 0 }, data: { definition: { id: 'feedback' } } },
      ],
      edges: [{ id: 'old', source: 'imp', sourceHandle: 'out', target: 'fb', targetHandle: 'impulse' }],
    });
    expect(restored.edges[0]).toMatchObject({
      type: 'impulse',
      animated: false,
      style: { strokeWidth: 3 },
    });
  });

  it('persists custom Float step precision in project files', () => {
    const node = {
      id: 'p', type: 'shaderNode', position: { x: 0, y: 0 },
      data: { definition: NODE_REGISTRY.param_float, value: '0.001', step: 0.001 },
    };
    const serialized = serializeGraph([node], []);
    expect(serialized.nodes[0].data.step).toBe(0.001);
    expect(rehydrateGraph(serialized).nodes[0].data.step).toBe(0.001);
  });
});

