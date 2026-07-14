import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { insertAutoAdapter } from '../core/autoAdapterSystem';
import { inlinePortHandleId } from '../core/inlinePortAdapters';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { Node } from 'reactflow';

/**
 * Regresja: Value Watcher (monitor) pokazywał W = 1.0 niezależnie od sygnału.
 * Przyczyny: (a) auto-adapter tworzył krawędź combine→monitor z sourceHandle
 * 'result', a Combine ma wyjście 'out' → kompilator nie znajdował typu,
 * fallbackował do float i obcinał vec4 przez vec3(...); (b) brak fallbacku
 * do outputs[0] przy nieznanym sourceHandle (stare zapisy).
 */

const glslangAvailable = hasGlslangValidator();

const param = (id: string, value: number): GraphNode => ({
  id, type: 'shaderNode', data: { definition: NODE_REGISTRY.param_float, value },
});

const buildMonitorGraph = (combineToMonitorHandle: string) => {
  const nodes: GraphNode[] = [
    param('p1', 0.1), param('p2', 0.2), param('p3', 0.3), param('p4', 0.4),
    { id: 'comb1', type: 'shaderNode', data: { definition: NODE_REGISTRY.combine_vec4 } },
    { id: 'mon1', type: 'monitorNode', data: { definition: NODE_REGISTRY.monitor } },
  ];
  const edges = [
    { source: 'p1', sourceHandle: 'out', target: 'comb1', targetHandle: 'x' },
    { source: 'p2', sourceHandle: 'out', target: 'comb1', targetHandle: 'y' },
    { source: 'p3', sourceHandle: 'out', target: 'comb1', targetHandle: 'z' },
    { source: 'p4', sourceHandle: 'out', target: 'comb1', targetHandle: 'w' },
    { source: 'comb1', sourceHandle: combineToMonitorHandle, target: 'mon1', targetHandle: 'in' },
  ];
  return { nodes, edges };
};

describe('Monitor W channel (vec4 passthrough)', () => {
  it('vec4 reaches gl_FragColor without vec3() truncation', () => {
    const { nodes, edges } = buildMonitorGraph('out');
    const shader = compileGraphToGLSL(nodes, edges, 'mon1');

    // Cała czwórka składowych w combine (parametry jako osobne zmienne)
    expect(shader).toContain('vec4 var_comb1 = vec4(var_p1, var_p2, var_p3, var_p4);');
    // gl_FragColor = surowy vec4 (W zachowane)
    expect(shader).toContain('gl_FragColor = var_comb1;');
    expect(shader).not.toContain('gl_FragColor = vec4(vec3(var_comb1), 1.0);');

    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, result.output).toBe(true);
    }
  });

  it('legacy sourceHandle "result" still compiles via outputs[0] fallback', () => {
    // Stare zapisy sprzed migracji — kompilator nie może obcinać W
    const { nodes, edges } = buildMonitorGraph('result');
    const shader = compileGraphToGLSL(nodes, edges, 'mon1');

    expect(shader).toContain('gl_FragColor = var_comb1;');
    expect(shader).not.toContain('vec3(var_comb1), 1.0');
  });

  it('auto-adapter expands the vec4 target and connects the float to X', () => {
    const nodes: Node[] = [
      { id: 'p1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY.param_float } },
      { id: 'mon1', type: 'monitorNode', position: { x: 300, y: 0 }, data: { definition: NODE_REGISTRY.monitor } },
    ];
    const result = insertAutoAdapter(
      nodes, [],
      { source: 'p1', sourceHandle: 'out', target: 'mon1', targetHandle: 'in' },
      'float', 'vec4'
    );

    expect(result.newNodes).toEqual([]);
    expect(result.updatedNodes[0].data.inlinePortExpansion.inputs).toEqual(['in']);
    expect(result.newEdges).toEqual([
      expect.objectContaining({
        source: 'p1',
        sourceHandle: 'out',
        target: 'mon1',
        targetHandle: inlinePortHandleId('input', 'in', 'x'),
      }),
    ]);
  });
});
