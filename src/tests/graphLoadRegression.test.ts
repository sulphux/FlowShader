import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { Node, Edge } from 'reactflow';

/**
 * Regresja: wczytanie zapisanego pliku (Load / refresh strony) powodowało
 * błędy kompilacji shaderów w oknach preview i głównym oknie.
 * Scenariusz odtworzony na rzeczywistym pliku Examples/TESTOWO.json.
 */

const TESTOWO_PATH = join(process.cwd(), 'Examples', 'TESTOWO.json');

const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(n => ({ id: n.id, type: n.type || 'shaderNode', data: n.data }));

const glslangAvailable = hasGlslangValidator();

const expectValidGLSL = (shader: string, label: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${label}: glslangValidator rejected shader:\n${result.output}\n--- SHADER ---\n${shader}`).toBe(true);
};

describe('Graph load regression (TESTOWO.json)', () => {
  let nodes: Node[];
  let edges: Edge[];

  beforeAll(() => {
    const parsed = JSON.parse(readFileSync(TESTOWO_PATH, 'utf8'));
    const restored = rehydrateGraph(parsed);
    nodes = restored.nodes;
    edges = restored.edges;
  });

  it('migrates legacy adapter edges (sourceHandle "result" → "out")', () => {
    const legacy = edges.filter(e => e.sourceHandle === 'result');
    expect(legacy).toHaveLength(0);
  });

  it('adapts smart_split ports based on connections after load', () => {
    const uvSplit = nodes.find(n => n.id === 'smart_split_1783542323517');
    expect(uvSplit).toBeDefined();
    // UV (vec2) → smart_split: input vec2, outputs X/Y
    expect(uvSplit!.data.definition.inputs[0].type).toBe('vec2');
    expect(uvSplit!.data.definition.outputs.map((o: { id: string }) => o.id)).toEqual(['x', 'y']);
  });

  it('compiles the main output shader to valid GLSL', () => {
    const shader = compileGraphToGLSL(toGraphNodes(nodes), edges);
    expectValidGLSL(shader, 'main output');
  });

  it('compiles every preview node shader to valid GLSL', () => {
    const previews = nodes.filter(n => n.data.definition.id === 'preview');
    expect(previews.length).toBeGreaterThan(0);
    previews.forEach(preview => {
      const shader = compileGraphToGLSL(toGraphNodes(nodes), edges, preview.id);
      expectValidGLSL(shader, `preview ${preview.id}`);
    });
  });

  it('compiles every monitor node shader to valid GLSL', () => {
    const monitors = nodes.filter(n => n.data.definition.id === 'monitor');
    expect(monitors.length).toBeGreaterThan(0);
    monitors.forEach(monitor => {
      const shader = compileGraphToGLSL(toGraphNodes(nodes), edges, monitor.id);
      expectValidGLSL(shader, `monitor ${monitor.id}`);
    });
  });

  it('preserves the W channel for monitors fed by combine_vec4', () => {
    // monitor_1783541760973 ← combine_vec4 (x=add, y=sub, z=mult, w=div)
    const shader = compileGraphToGLSL(toGraphNodes(nodes), edges, 'monitor_1783541760973');
    // vec4 musi trafić do gl_FragColor bez obcięcia przez vec3(...)
    expect(shader).toMatch(/gl_FragColor = var_combine_vec4_adapter_\w+;/);
    expect(shader).not.toMatch(/gl_FragColor = vec4\(vec3\(var_combine_vec4/);
  });

  it('survives a save → load roundtrip with adapted ports intact', () => {
    const serialized = serializeGraph(nodes, edges, { x: 0, y: 0, zoom: 1 });
    const restored = rehydrateGraph(JSON.parse(JSON.stringify(serialized)));

    const uvSplit = restored.nodes.find(n => n.id === 'smart_split_1783542323517');
    expect(uvSplit!.data.definition.inputs[0].type).toBe('vec2');

    const shader = compileGraphToGLSL(toGraphNodes(restored.nodes), restored.edges);
    expectValidGLSL(shader, 'main output after roundtrip');

    // Definicje muszą mieć działające glslTemplate (funkcje nie przechodzą przez JSON)
    restored.nodes.forEach(n => {
      expect(typeof n.data.definition.glslTemplate, `node ${n.id}`).toBe('function');
    });
  });
});
