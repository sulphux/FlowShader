import { describe, it, expect, beforeEach } from 'vitest';
import { addCustomNode, loadCustomNodes, extractCustomNodePorts } from '../core/customNodeManager';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';

describe('Custom Node Port Refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('Port Addition', () => {
    it('should extract new input port from Custom Input nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_input', 
            data: { 
              value: 'Input A',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 0 } 
          },
          { 
            id: '2', 
            type: 'custom_input', 
            data: { 
              value: 'Input B',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 100 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.inputs.length).toBe(2);
      expect(ports.inputs[0].label).toBe('Input A');
      expect(ports.inputs[1].label).toBe('Input B');
    });

    it('should extract new output port from Custom Output nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_output', 
            data: { 
              value: 'Output A',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 0, y: 0 } 
          },
          { 
            id: '2', 
            type: 'custom_output', 
            data: { 
              value: 'Output B',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 0, y: 100 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.outputs.length).toBe(2);
      expect(ports.outputs[0].label).toBe('Output A');
      expect(ports.outputs[1].label).toBe('Output B');
    });
  });

  describe('Port Removal', () => {
    it('should not include removed Custom Input nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_input', 
            data: { 
              value: 'Input A',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 0 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.inputs.length).toBe(1);
      expect(ports.inputs[0].label).toBe('Input A');
    });

    it('should not include removed Custom Output nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_output', 
            data: { 
              value: 'Output A',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 0, y: 0 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.outputs.length).toBe(1);
      expect(ports.outputs[0].label).toBe('Output A');
    });
  });

  describe('Port Type Changes', () => {
    it('should extract auto type for Custom Input nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_input', 
            data: { 
              value: 'Input A',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 0 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.inputs[0].type).toBe('auto');
    });

    it('should extract auto type for Custom Output nodes', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_output', 
            data: { 
              value: 'Output A',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 0, y: 0 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.outputs[0].type).toBe('auto');
    });
  });

  describe('Instance Updates', () => {
    it('should update NODE_REGISTRY when custom node is saved', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        type: 'custom_test_node',
        label: 'Test Node',
        category: 'Custom',
        isCustom: true,
        inputs: { a: 'float' },
        outputs: {},
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)'
      };

      addCustomNode(customNode);
      loadCustomNodes();
      
      const loaded = loadCustomNodes();
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe('custom_test_node');
    });

    it('should store and load multiple custom node instances', () => {
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

      const loaded = loadCustomNodes();
      expect(loaded.length).toBe(2);
      expect(loaded.some(n => n.id === 'custom_node1')).toBe(true);
      expect(loaded.some(n => n.id === 'custom_node2')).toBe(true);
    });
  });

  describe('Connection Preservation', () => {
    it('should extract ports from connected subgraph', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_input', 
            data: { 
              value: 'Input A',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 0 } 
          },
          { 
            id: '2', 
            type: 'add', 
            data: { 
              definition: { id: 'add' }
            }, 
            position: { x: 200, y: 0 } 
          },
          { 
            id: '3', 
            type: 'custom_output', 
            data: { 
              value: 'Output A',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 400, y: 0 } 
          }
        ] as Node[],
        edges: [
          { id: 'e1', source: '1', sourceHandle: 'value', target: '2', targetHandle: 'a' },
          { id: 'e2', source: '2', sourceHandle: 'result', target: '3', targetHandle: 'value' }
        ] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.inputs.length).toBe(1);
      expect(ports.outputs.length).toBe(1);
      expect(subgraph.edges.length).toBe(2);
    });

    it('should handle empty subgraph with no connections', () => {
      const subgraph = {
        nodes: [
          { 
            id: '1', 
            type: 'custom_input', 
            data: { 
              value: 'Input A',
              definition: { id: 'custom_input', controls: { defaultValue: 'Input' } }
            }, 
            position: { x: 0, y: 0 } 
          },
          { 
            id: '2', 
            type: 'custom_output', 
            data: { 
              value: 'Output A',
              definition: { id: 'custom_output', controls: { defaultValue: 'Output' } }
            }, 
            position: { x: 200, y: 0 } 
          }
        ] as Node[],
        edges: [] as Edge[]
      };

      const ports = extractCustomNodePorts(subgraph);
      expect(ports.inputs.length).toBe(1);
      expect(ports.outputs.length).toBe(1);
      expect(subgraph.edges.length).toBe(0);
    });
  });
});
