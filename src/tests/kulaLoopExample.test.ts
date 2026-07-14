import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Node } from 'reactflow';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { rehydrateGraph } from '../core/graphRehydration';
import { collectRuntimeResources } from '../core/runtimeResources';
import { validateWithGlslangValidator } from './utils/glslangValidate';

const EXAMPLE_PATH = join(process.cwd(), 'Examples', 'kula-loop.json');

const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(node => ({ id: node.id, type: node.type || 'shaderNode', data: node.data }));

describe('GLKITTY sphere Loop / Iterate example', () => {
  beforeEach(() => localStorage.clear());

  it('loads all embedded helpers and compiles the raymarch loop to valid GLSL', () => {
    const restored = rehydrateGraph(JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8')));
    const nodes = toGraphNodes(restored.nodes);
    const shader = compileGraphToGLSL(nodes, restored.edges, 'out1');

    expect(nodes).toHaveLength(5);
    expect(nodes.some(node => node.data.definition.isCustom)).toBe(false);
    expect(nodes.find(node => node.id === 'raymarch_loop')?.data.iterations).toBe(192);
    expect(shader).toContain('loop_raymarch_loop_i < 192');
    expect(shader).toContain('custom_raymarch_step(var_raymarch_loop_state');
    expect(shader).toContain('custom_map(');
    expect(shader).toContain('custom_noise(');
    expect(shader).toContain('custom_rotatey(');
    expect(shader).toContain('if (state.y < 0.5)');
    expect(shader).toContain('gl_FragColor = vec4(var_raymarch_shade, 1.0)');

    const resources = collectRuntimeResources(nodes);
    expect(resources.textures.length).toBeGreaterThanOrEqual(2);

    const validation = validateWithGlslangValidator(shader, 'frag');
    expect(validation.ok, `${validation.output}\n${shader}`).toBe(true);
  });
});
