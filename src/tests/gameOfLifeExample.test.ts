import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Edge, Node } from 'reactflow';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { compileFeedbackPasses } from '../core/feedbackPasses';
import { rehydrateGraph } from '../core/graphRehydration';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

const EXAMPLE_PATH = join(process.cwd(), 'Examples', 'game-of-life.json');

const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(node => ({ id: node.id, type: node.type || 'shaderNode', data: node.data }));

const expectValidGLSL = (shader: string, label: string) => {
  if (!hasGlslangValidator()) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${label}:\n${result.output}\n${shader}`).toBe(true);
};

describe('Game of Life example', () => {
  const parsed = JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8'));
  const restored = rehydrateGraph(parsed);
  const nodes = toGraphNodes(restored.nodes);
  const edges = restored.edges as Edge[];

  it('keeps the graph minimal and stores one board in Snapshot mode', () => {
    expect(nodes).toHaveLength(7);
    expect(nodes.filter(node => node.data.definition.id === 'code_glsl')).toHaveLength(2);
    expect(nodes.filter(node => node.data.definition.id === 'feedback')).toHaveLength(1);
    expect(nodes.find(node => node.id === 'life_buffer')?.data.captureMode).toBe('snapshot');
    expect(edges).toContainEqual(expect.objectContaining({
      source: 'life_impulse',
      target: 'life_buffer',
      targetHandle: 'impulse',
    }));
  });

  it('samples exactly eight wrapped neighbours and uses the previous alpha as the initialization flag', () => {
    const neighbours = nodes.find(node => node.id === 'life_neighbors')?.data.value as string;
    const rule = nodes.find(node => node.id === 'life_rule')?.data.value as string;

    expect(neighbours.match(/texture2D\(u_feedback_life_buffer/g)).toHaveLength(8);
    expect(neighbours.match(/fract\(screenUv/g)).toHaveLength(8);
    expect(rule).toContain('abs(a - 3.0)');
    expect(rule).toContain('abs(a - 2.0)');
    expect(rule).toContain('texture2D(u_feedback_life_buffer, screenUv).w');
  });

  it('implements Conway birth and survival rules for every possible neighbour count', () => {
    const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
    const shaderRule = (alive: number, neighbours: number) =>
      clamp01(1 - Math.abs(neighbours - 3))
      + alive * clamp01(1 - Math.abs(neighbours - 2));

    for (let neighbours = 0; neighbours <= 8; neighbours += 1) {
      expect(shaderRule(0, neighbours), `dead cell with ${neighbours} neighbours`)
        .toBe(neighbours === 3 ? 1 : 0);
      expect(shaderRule(1, neighbours), `live cell with ${neighbours} neighbours`)
        .toBe(neighbours === 2 || neighbours === 3 ? 1 : 0);
    }
  });

  it('compiles both the visible output and the off-screen simulation pass as valid GLSL', () => {
    const mainShader = compileGraphToGLSL(nodes, edges, 'life_output');
    const passes = compileFeedbackPasses(nodes, edges);

    expect(passes).toHaveLength(1);
    expect(passes[0].nodeId).toBe('life_buffer');
    expect(passes[0].captureMode).toBe('snapshot');
    expect(passes[0].shader).toContain('u_feedback_life_buffer');
    expectValidGLSL(mainShader, 'Game of Life output');
    expectValidGLSL(passes[0].shader, 'Game of Life simulation pass');
  });
});
