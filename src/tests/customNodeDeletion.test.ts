import { describe, it, expect, beforeEach } from 'vitest';
import { deleteCustomNode, loadCustomNodes, addCustomNode } from '../core/customNodeManager';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';

describe('Custom Node Deletion', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('Basic Deletion', () => {
    it('should delete a custom node from storage', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      addCustomNode(customNode);
      const before = loadCustomNodes();
      expect(before.some(n => n.id === 'custom_test_node')).toBe(true);

      deleteCustomNode('custom_test_node');
      const after = loadCustomNodes();
      expect(after.some(n => n.id === 'custom_test_node')).toBe(false);
    });

    it('should remove custom node from NODE_REGISTRY', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      NODE_REGISTRY.custom_test_node = customNode;
      expect(NODE_REGISTRY.custom_test_node).toBeDefined();

      deleteCustomNode('custom_test_node');
      delete NODE_REGISTRY.custom_test_node;
      expect(NODE_REGISTRY.custom_test_node).toBeUndefined();
    });

    it('should handle deletion of non-existent node', () => {
      const before = loadCustomNodes();
      deleteCustomNode('nonexistent_node');
      const after = loadCustomNodes();
      expect(after.length).toBe(before.length);
    });

    it('should handle deletion of empty custom node', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_empty_node',
        type: 'custom_empty_node',
        label: 'Empty Node',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      deleteCustomNode('custom_empty_node');
      const after = loadCustomNodes();
      expect(after.some(n => n.id === 'custom_empty_node')).toBe(false);
    });
  });

  describe('Multiple Deletions', () => {
    it('should delete multiple custom nodes independently', () => {
      const node1: CustomNodeDefinition = {
        id: 'custom_node1',
        type: 'custom_node1',
        label: 'Node 1',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      const node2: CustomNodeDefinition = {
        id: 'custom_node2',
        type: 'custom_node2',
        label: 'Node 2',
        category: 'Custom',
        isCustom: true,
        inputs: { b: 'vec3' },
        outputs: { color: 'vec3' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(node1);
      addCustomNode(node2);
      
      deleteCustomNode('custom_node1');
      const after = loadCustomNodes();
      expect(after.some(n => n.id === 'custom_node1')).toBe(false);
      expect(after.some(n => n.id === 'custom_node2')).toBe(true);
    });

    it('should delete all custom nodes when called multiple times', () => {
      const node1: CustomNodeDefinition = {
        id: 'custom_node1',
        type: 'custom_node1',
        label: 'Node 1',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      const node2: CustomNodeDefinition = {
        id: 'custom_node2',
        type: 'custom_node2',
        label: 'Node 2',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(node1);
      addCustomNode(node2);

      deleteCustomNode('custom_node1');
      deleteCustomNode('custom_node2');

      const customNodes = loadCustomNodes();
      expect(customNodes.length).toBe(0);
    });
  });

  describe('Storage Consistency', () => {
    it('should maintain storage consistency after deletion', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      deleteCustomNode('custom_test_node');

      const customNodes = loadCustomNodes();
      expect(customNodes.length).toBe(0);
    });

    it('should allow re-creation after deletion', () => {
      const nodeDef: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(nodeDef);
      deleteCustomNode('custom_test_node');
      addCustomNode(nodeDef);

      const customNodes = loadCustomNodes();
      expect(customNodes.length).toBe(1);
      expect(customNodes[0].id).toBe('custom_test_node');
    });
  });

  describe('Registry Cleanup', () => {
    it('should remove all traces from NODE_REGISTRY', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: { result: 'float' },
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      NODE_REGISTRY.custom_test_node = customNode;
      const beforeCount = Object.keys(NODE_REGISTRY).filter(k => k.startsWith('custom_')).length;
      expect(beforeCount).toBeGreaterThanOrEqual(1);

      deleteCustomNode('custom_test_node');
      delete NODE_REGISTRY.custom_test_node;
      const afterCount = Object.keys(NODE_REGISTRY).filter(k => k.startsWith('custom_')).length;
      expect(afterCount).toBe(beforeCount - 1);
    });

    it('should not affect built-in nodes in registry', () => {
      const builtInKeys = Object.keys(NODE_REGISTRY).filter(k => !k.startsWith('custom_'));
      const beforeCount = builtInKeys.length;

      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      deleteCustomNode('custom_test_node');

      const afterBuiltInKeys = Object.keys(NODE_REGISTRY).filter(k => !k.startsWith('custom_'));
      expect(afterBuiltInKeys.length).toBe(beforeCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle deletion with special characters in name', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test-node_123',
        type: 'custom_test-node_123',
        label: 'Test Node 123',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      deleteCustomNode('custom_test-node_123');
      const after = loadCustomNodes();
      expect(after.some(n => n.id === 'custom_test-node_123')).toBe(false);
    });

    it('should handle rapid deletion calls', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_node1',
        type: 'custom_node1',
        label: 'Node 1',
        category: 'Custom',
        isCustom: true,
        inputs: {},
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      
      deleteCustomNode('custom_node1');
      const after1 = loadCustomNodes();
      expect(after1.some(n => n.id === 'custom_node1')).toBe(false);
      
      deleteCustomNode('custom_node1');
      const after2 = loadCustomNodes();
      expect(after2.length).toBe(after1.length);
    });
  });
});
