import { describe, expect, it } from 'vitest';
import { BUILTIN_EXAMPLES, loadBuiltinExample } from '../core/builtinExamples';

describe('built-in examples catalog', () => {
  it('has unique ids and user-facing metadata', () => {
    expect(BUILTIN_EXAMPLES).toHaveLength(4);
    expect(new Set(BUILTIN_EXAMPLES.map(example => example.id)).size).toBe(BUILTIN_EXAMPLES.length);
    BUILTIN_EXAMPLES.forEach(example => {
      expect(example.title).not.toBe('');
      expect(example.description.length).toBeGreaterThan(20);
      expect(example.category).not.toBe('');
    });
  });

  it.each(BUILTIN_EXAMPLES.map(example => [example.id]))('bundles and parses %s', async id => {
    const graph = JSON.parse(await loadBuiltinExample(id));
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.nodes.some((node: { data?: { definition?: { id?: string } } }) => node.data?.definition?.id === 'output')).toBe(true);
  });

  it('rejects an unknown example without changing anything', async () => {
    await expect(loadBuiltinExample('missing-example')).rejects.toThrow('Unknown built-in example');
  });
});
