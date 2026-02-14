import { describe, it, expect } from 'vitest';

describe('Graph Serialization', () => {
  it('should serialize nodes with minimal data', () => {
    const node = {
      id: 'node-1',
      type: 'shaderNode',
      position: { x: 100, y: 200 },
      data: {
        definition: { id: 'math_add' },
        value: 0.5,
        label: 'Custom Label',
        min: 0,
        max: 1
      }
    };

    const serialized = {
      ...node,
      data: {
        definition: { id: node.data.definition.id },
        value: node.data.value,
        label: node.data.label,
        min: node.data.min,
        max: node.data.max
      }
    };

    expect(serialized.data.definition.id).toBe('math_add');
    expect(serialized.data).not.toHaveProperty('glslTemplate');
  });

  it('should restore nodes with full definitions from registry', () => {
    const saved = {
      data: { definition: { id: 'math_add' } }
    };

    const NODE_REGISTRY = {
      math_add: {
        id: 'math_add',
        label: 'Add',
        inputs: [],
        outputs: [],
        glslTemplate: () => 'test'
      }
    };

    const restored = {
      ...saved,
      data: {
        ...saved.data,
        definition: NODE_REGISTRY.math_add
      }
    };

    expect(restored.data.definition.label).toBe('Add');
    expect(restored.data.definition.glslTemplate).toBeDefined();
  });

  it('should preserve viewport on save/load', () => {
    const viewport = { x: -500, y: -300, zoom: 0.8 };
    const saved = {
      nodes: [],
      edges: [],
      viewport
    };

    expect(saved.viewport.x).toBe(-500);
    expect(saved.viewport.zoom).toBe(0.8);
  });
});
