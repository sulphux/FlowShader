import { describe, it, expect, beforeEach } from 'vitest';
import { addCustomNode, loadCustomNodes, extractCustomNodePorts, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import { CustomInputNode } from '../nodes/CustomInput';
import { CustomOutputNode } from '../nodes/CustomOutput';
import type { Node, Edge } from 'reactflow';

/**
 * Test suite: Custom Node Port Synchronization
 * 
 * Bug: When Custom Input/Output nodes inside a custom node are modified,
 * the parent custom node's ports don't automatically sync.
 * 
 * Expected: extractCustomNodePorts() should read the CURRENT node.data.value
 * to sync port labels when navigating up from custom node subgraph.
 */
describe('Custom Node Port Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    // Clean up custom nodes from registry
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('Integration: Full Navigation Flow', () => {
    it('should sync Custom Output label changes after navigation', () => {
      // Step 1: Create initial custom node with Custom Output (label="Output")
      const customOutputNodeId = 'custom_output_1';
      const initialSubgraph: Node[] = [
        {
          id: customOutputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomOutputNode, // Use imported definition directly
            value: 'Output', // Initial label
          }
        } as Node
      ];

      // Save custom node to library
      let customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        label: 'Test Node',
        description: 'Test custom node',
        compact: false,
        inputs: [],
        outputs: [{ id: customOutputNodeId, label: 'Output', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: initialSubgraph,
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNode);
      (NODE_REGISTRY as Record<string, unknown>)['custom_test_node'] = customNode;

      // Step 2: Simulate user entering custom node and changing label
      const updatedSubgraph: Node[] = [
        {
          ...initialSubgraph[0],
          data: {
            ...initialSubgraph[0].data,
            value: 'Result', // User changed "Output" → "Result"
          }
        } as Node
      ];

      // Step 3: Simulate navigateBack() logic - extract ports from updated subgraph
      const ports = extractCustomNodePorts({ nodes: updatedSubgraph });
      
      // Step 4: Update custom node definition (as done in navigateBack)
      customNode = {
        ...customNode,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNode.outputs,
        subgraph: {
          nodes: updatedSubgraph,
          edges: []
        }
      };
      
      addCustomNode(customNode);
      (NODE_REGISTRY as Record<string, unknown>)['custom_test_node'] = customNode;

      // Step 5: Verify the custom node in registry has updated ports
      const savedNode = NODE_REGISTRY['custom_test_node'] as CustomNodeDefinition;
      expect(savedNode.outputs.length).toBe(1);
      expect(savedNode.outputs[0].label).toBe('Result'); // ✅ Should reflect new label
    });

    it('should sync Custom Input label changes after navigation', () => {
      // Step 1: Create initial custom node with Custom Input (label="Input")
      const customInputNodeId = 'custom_input_1';
      const initialSubgraph: Node[] = [
        {
          id: customInputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomInputNode, // Use imported definition directly
            value: 'Input', // Initial label
          }
        } as Node
      ];

      let customNode: CustomNodeDefinition = {
        id: 'custom_test_input_node',
        label: 'Test Input Node',
        description: 'Test custom node with input',
        compact: false,
        inputs: [{ id: customInputNodeId, label: 'Input', type: 'auto' }],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: initialSubgraph,
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNode);
      (NODE_REGISTRY as Record<string, unknown>)['custom_test_input_node'] = customNode;

      // Step 2: Simulate user changing label
      const updatedSubgraph: Node[] = [
        {
          ...initialSubgraph[0],
          data: {
            ...initialSubgraph[0].data,
            value: 'Texture Coordinate', // User changed label
          }
        } as Node
      ];

      // Step 3: Extract ports (as done in navigateBack)
      const ports = extractCustomNodePorts({ nodes: updatedSubgraph });
      
      // Step 4: Update custom node definition
      customNode = {
        ...customNode,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNode.inputs,
        subgraph: {
          nodes: updatedSubgraph,
          edges: []
        }
      };
      
      addCustomNode(customNode);
      (NODE_REGISTRY as Record<string, unknown>)['custom_test_input_node'] = customNode;

      // Step 5: Verify
      const savedNode = NODE_REGISTRY['custom_test_input_node'] as CustomNodeDefinition;
      expect(savedNode.inputs.length).toBe(1);
      expect(savedNode.inputs[0].label).toBe('Texture Coordinate'); // ✅ Should reflect new label
    });
  });

  describe('Label Synchronization', () => {
    it('should sync Custom Output label changes to parent port', () => {
      // Create a custom node with a Custom Output node (label="Output")
      const customOutputNodeId = 'custom_output_1';
      const subgraphNodes: Node[] = [
        {
          id: customOutputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomOutputNode,
            value: 'Output', // Initial label
          }
        } as Node
      ];

      // Save custom node to library
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_node',
        label: 'Test Node',
        description: 'Test custom node',
        compact: false,
        inputs: [],
        outputs: [{ id: customOutputNodeId, label: 'Output', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: subgraphNodes,
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNode);

      // Simulate user editing the Custom Output node's label
      const updatedSubgraphNodes: Node[] = [
        {
          ...subgraphNodes[0],
          data: {
            ...subgraphNodes[0].data,
            value: 'Result', // User changed label from "Output" → "Result"
          }
        } as Node
      ];

      // Navigate up: Extract ports from updated subgraph
      const ports = extractCustomNodePorts({ nodes: updatedSubgraphNodes });

      // EXPECT: Port label should reflect the CURRENT value
      expect(ports.outputs.length).toBe(1);
      expect(ports.outputs[0].label).toBe('Result'); // ❌ This should PASS but currently FAILS
      expect(ports.outputs[0].id).toBe(customOutputNodeId);
    });

    it('should sync Custom Input label changes to parent port', () => {
      // Create a custom node with a Custom Input node (label="Input")
      const customInputNodeId = 'custom_input_1';
      const subgraphNodes: Node[] = [
        {
          id: customInputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomInputNode,
            value: 'Input', // Initial label
          }
        } as Node
      ];

      // Save custom node to library
      const customNode: CustomNodeDefinition = {
        id: 'custom_test_input_node',
        label: 'Test Input Node',
        description: 'Test custom node with input',
        compact: false,
        inputs: [{ id: customInputNodeId, label: 'Input', type: 'auto' }],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: subgraphNodes,
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNode);

      // Simulate user editing the Custom Input node's label
      const updatedSubgraphNodes: Node[] = [
        {
          ...subgraphNodes[0],
          data: {
            ...subgraphNodes[0].data,
            value: 'Texture Coordinate', // User changed label
          }
        } as Node
      ];

      // Navigate up: Extract ports from updated subgraph
      const ports = extractCustomNodePorts({ nodes: updatedSubgraphNodes });

      // EXPECT: Port label should reflect the CURRENT value
      expect(ports.inputs.length).toBe(1);
      expect(ports.inputs[0].label).toBe('Texture Coordinate'); // ❌ Should PASS but FAILS
      expect(ports.inputs[0].id).toBe(customInputNodeId);
    });
  });

  describe('Type Synchronization', () => {
    it('should sync Custom Input detected type to parent port', () => {
      // Create a Custom Input node with detected type
      const customInputNodeId = 'custom_input_typed';
      const subgraphNodes: Node[] = [
        {
          id: customInputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomInputNode,
            value: 'Position',
            detectedType: 'vec3', // Type detected from incoming connection
          }
        } as Node
      ];

      // Extract ports
      const ports = extractCustomNodePorts({ nodes: subgraphNodes });

      // EXPECT: Type should be vec3, not 'auto'
      expect(ports.inputs.length).toBe(1);
      expect(ports.inputs[0].type).toBe('vec3'); // ✅ This should already work
      expect(ports.inputs[0].label).toBe('Position');
    });

    it('should sync Custom Output detected type to parent port', () => {
      // Create a Custom Output node with detected type
      const customOutputNodeId = 'custom_output_typed';
      const subgraphNodes: Node[] = [
        {
          id: customOutputNodeId,
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomOutputNode,
            value: 'Color',
            detectedType: 'vec4', // Type detected from outgoing connection
          }
        } as Node
      ];

      // Extract ports
      const ports = extractCustomNodePorts({ nodes: subgraphNodes });

      // EXPECT: Type should be vec4, not 'auto'
      expect(ports.outputs.length).toBe(1);
      expect(ports.outputs[0].type).toBe('vec4'); // ✅ This should already work
      expect(ports.outputs[0].label).toBe('Color');
    });
  });

  describe('Port Count Synchronization', () => {
    it('should sync when Custom Input nodes are added', () => {
      // Initial: 1 Custom Input
      const initialNodes: Node[] = [
        {
          id: 'custom_input_1',
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomInputNode,
            value: 'Input A',
          }
        } as Node
      ];

      const portsInitial = extractCustomNodePorts({ nodes: initialNodes });
      expect(portsInitial.inputs.length).toBe(1);

      // Add 2nd Custom Input
      const updatedNodes: Node[] = [
        ...initialNodes,
        {
          id: 'custom_input_2',
          type: 'shaderNode',
          position: { x: 100, y: 200 },
          data: {
            definition: CustomInputNode,
            value: 'Input B',
          }
        } as Node
      ];

      // Navigate up: Extract ports from updated subgraph
      const portsUpdated = extractCustomNodePorts({ nodes: updatedNodes });

      // EXPECT: Parent should have 2 input ports now
      expect(portsUpdated.inputs.length).toBe(2);
      expect(portsUpdated.inputs[0].label).toBe('Input A');
      expect(portsUpdated.inputs[1].label).toBe('Input B');
    });

    it('should sync when Custom Output nodes are added', () => {
      // Initial: 1 Custom Output
      const initialNodes: Node[] = [
        {
          id: 'custom_output_1',
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          data: {
            definition: CustomOutputNode,
            value: 'Output A',
          }
        } as Node
      ];

      const portsInitial = extractCustomNodePorts({ nodes: initialNodes });
      expect(portsInitial.outputs.length).toBe(1);

      // Add 2nd Custom Output
      const updatedNodes: Node[] = [
        ...initialNodes,
        {
          id: 'custom_output_2',
          type: 'shaderNode',
          position: { x: 100, y: 200 },
          data: {
            definition: CustomOutputNode,
            value: 'Output B',
          }
        } as Node
      ];

      // Navigate up: Extract ports from updated subgraph
      const portsUpdated = extractCustomNodePorts({ nodes: updatedNodes });

      // EXPECT: Parent should have 2 output ports now
      expect(portsUpdated.outputs.length).toBe(2);
      expect(portsUpdated.outputs[0].label).toBe('Output A');
      expect(portsUpdated.outputs[1].label).toBe('Output B');
    });
  });
});

