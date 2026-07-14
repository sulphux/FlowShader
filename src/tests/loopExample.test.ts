import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Node } from 'reactflow';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { rehydrateGraph } from '../core/graphRehydration';
import { validateWithGlslangValidator } from './utils/glslangValidate';

const EXAMPLE_PATH = join(process.cwd(), 'Examples', 'loop-iterate-basic.json');

const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(node => ({ id: node.id, type: node.type || 'shaderNode', data: node.data }));

describe('Loop / Iterate basic example', () => {
  beforeEach(() => localStorage.clear());

  it('loads its embedded visual Step and compiles to valid bounded GLSL', () => {
    const restored = rehydrateGraph(JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8')));
    const nodes = toGraphNodes(restored.nodes);
    const shader = compileGraphToGLSL(nodes, restored.edges, 'loop_output');

    expect(nodes.find(node => node.id === 'loop_demo')?.data.iterations).toBe(11);
    expect(shader).toContain('loop_loop_demo_i < 11');
    expect(shader).toContain('custom_loop_step_demo(var_loop_demo_state');
    expect(shader).toContain('/ 10.0');

    const validation = validateWithGlslangValidator(shader, 'frag');
    expect(validation.ok, `${validation.output}\n${shader}`).toBe(true);
  });
});

