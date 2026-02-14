import { describe, it, expect, beforeEach } from 'vitest';
import { loadCustomNodes, addCustomNode, extractCustomNodePorts } from './customNodeManager';

describe('customNodeManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and load custom nodes from localStorage', () => {
    const customNode = {
      id: 'custom_test',
      label: 'Test',
      description: 'Test custom node',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' as const }],
      isCustom: true as const,
      subgraph: { nodes: [], edges: [] },
      glslTemplate: () => 'test'
    };

    addCustomNode(customNode);
    const loaded = loadCustomNodes();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('custom_test');
    expect(loaded[0].label).toBe('Test');
  });

  it('should extract ports from Custom Input/Output nodes', () => {
    const nodes = [
      {
        id: 'input-1',
        data: {
          definition: { id: 'custom_input' },
          value: 'Color' // Port name is in value field
        }
      },
      {
        id: 'output-1',
        data: {
          definition: { id: 'custom_output' },
          value: 'Result' // Port name is in value field
        }
      },
      {
        id: 'math-1',
        data: {
          definition: { id: 'math_add' }
        }
      }
    ];

    const ports = extractCustomNodePorts({ nodes });

    expect(ports.inputs).toHaveLength(1);
    expect(ports.inputs[0].id).toBe('input-1');
    expect(ports.inputs[0].label).toBe('Color');

    expect(ports.outputs).toHaveLength(1);
    expect(ports.outputs[0].id).toBe('output-1');
    expect(ports.outputs[0].label).toBe('Result');
  });

  it('should handle empty custom nodes gracefully', () => {
    const loaded = loadCustomNodes();
    expect(loaded).toEqual([]);
  });

  it('should handle corrupt localStorage data', () => {
    localStorage.setItem('customNodes', 'invalid json{{{');
    const loaded = loadCustomNodes();
    expect(loaded).toEqual([]);
  });

  it('should not duplicate custom nodes with same id', () => {
    const customNode1 = {
      id: 'custom_test',
      label: 'Test 1',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' as const }],
      isCustom: true as const,
      subgraph: { nodes: [], edges: [] },
      glslTemplate: () => 'test'
    };

    const customNode2 = {
      ...customNode1,
      label: 'Test 2 (Updated)'
    };

    addCustomNode(customNode1);
    addCustomNode(customNode2);

    const loaded = loadCustomNodes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].label).toBe('Test 2 (Updated)');
  });

  it('should restore glslTemplate function after load', () => {
    const customNode = {
      id: 'custom_test',
      label: 'Test',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' as const }],
      isCustom: true as const,
      subgraph: { nodes: [], edges: [] },
      glslTemplate: () => 'original' // Will be lost in JSON
    };

    addCustomNode(customNode);
    const loaded = loadCustomNodes();

    // glslTemplate should be restored (not undefined)
    expect(loaded[0].glslTemplate).toBeDefined();
    expect(typeof loaded[0].glslTemplate).toBe('function');
    
    // Should not throw when called
    expect(() => {
      loaded[0].glslTemplate({});
    }).not.toThrow();
  });

  it('should restore node definitions in subgraph', () => {
    const customNode = {
      id: 'custom_with_subgraph',
      label: 'Test Subgraph',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' as const }],
      isCustom: true as const,
      subgraph: {
        nodes: [{
          id: 'uv-1',
          type: 'uv',
          data: {
            definition: { id: 'uv' } // Only ID saved, no glslTemplate
          }
        }],
        edges: []
      },
      glslTemplate: () => 'test'
    };

    addCustomNode(customNode);
    const loaded = loadCustomNodes();

    // Subgraph node should have full definition from NODE_REGISTRY
    const subNode = loaded[0].subgraph.nodes[0];
    expect(subNode.data.definition.glslTemplate).toBeDefined();
    expect(typeof subNode.data.definition.glslTemplate).toBe('function');
    
    // Should not throw when compiling
    expect(() => {
      subNode.data.definition.glslTemplate({});
    }).not.toThrow();
  });
});
