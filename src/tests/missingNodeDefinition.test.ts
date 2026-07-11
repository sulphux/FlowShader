import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rehydrateGraph } from '../core/graphRehydration';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { Node } from 'reactflow';

/**
 * Regresja: gdy zapisany node odwołuje się do definicji, której nie da się
 * odtworzyć (najczęściej custom node zapisany w innej przeglądarce/profilu —
 * biblioteka custom nodów żyje w localStorage, nie w pliku), rehydrateGraph
 * po cichu fallbackował na NODE_REGISTRY['output']. Node wyglądał i zachowywał
 * się jak drugi Output — mylące (nadal pokazywał zapisaną nazwę np. "BeautyNode"
 * w tytule, ale renderował pojedynczy port "Color" zamiast prawdziwych portów),
 * a w kompilatorze `nodes.find(n => n.data.definition.id === 'output')` mogło
 * trafić na fałszywy node zamiast prawdziwego Output. Odtworzone na realnym
 * pliku Examples/shader_graph.json (node "BeautyNode" → custom_beautynode).
 */

const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(n => ({ id: n.id, type: n.type || 'shaderNode', data: n.data }));

const glslangAvailable = hasGlslangValidator();

describe('rehydrateGraph handles an unresolvable node definition', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not silently become an Output node', () => {
    const parsed = {
      nodes: [
        { id: 'out1', data: { definition: { id: 'output' } } },
        { id: 'ghost1', data: { definition: { id: 'custom_beautynode' }, label: 'BeautyNode' } },
      ],
      edges: [],
    };
    const { nodes } = rehydrateGraph(parsed);

    const ghost = nodes.find(n => n.id === 'ghost1')!;
    expect(ghost.data.definition.id).not.toBe('output');
    expect(ghost.data.definition.id).toBe('__missing__');
    expect(ghost.data.definition.missingOriginalId).toBe('custom_beautynode');
    expect(ghost.data.definition.outputs).toHaveLength(0);

    // Exactly one node still resolves as the real Output
    const outputs = nodes.filter(n => n.data.definition.id === 'output');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].id).toBe('out1');
  });

  it('the placeholder is skipped by the compiler (no bogus declaration, no crash)', () => {
    const parsed = {
      nodes: [
        { id: 'out1', data: { definition: { id: 'output' } } },
        { id: 'ghost1', data: { definition: { id: 'custom_beautynode' }, label: 'BeautyNode' } },
      ],
      edges: [],
    };
    const { nodes, edges } = rehydrateGraph(parsed);
    const shader = compileGraphToGLSL(toGraphNodes(nodes), edges);

    expect(shader).not.toContain('var_ghost1');
    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, result.output).toBe(true);
    }
  });

  it('real file: Examples/shader_graph.json compiles cleanly with the custom node unresolved', () => {
    const path = join(process.cwd(), 'Examples', 'shader_graph.json');
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const { nodes, edges } = rehydrateGraph(parsed);

    // Instance id carries a Date.now() suffix that changes every time the
    // user re-saves this file from the app — match by prefix, not exact id.
    const beauty = nodes.find(n => n.id.startsWith('custom_beautynode_'));
    expect(beauty).toBeDefined();
    expect(beauty!.data.definition.id).toBe('__missing__');

    const shader = compileGraphToGLSL(toGraphNodes(nodes), edges);
    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, result.output).toBe(true);
    }
  });
});
