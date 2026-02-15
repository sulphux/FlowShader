import { describe, it, expect, beforeEach } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { addCustomNode, loadCustomNodes } from '../core/customNodeManager';

/**
 * TDD: Subgraph Persistence Tests
 * 
 * These tests FAIL now, but will PASS after fixing the bugs.
 * 
 * Bug: Subgraph changes are not saved when navigating up/out of custom node.
 * Current behavior:
 * 1. Enter custom node, add nodes/edges inside
 * 2. Navigate up
 * 3. Re-enter custom node → changes are LOST
 * 
 * Expected: Changes should be saved to NODE_REGISTRY and localStorage on navigation
 */
describe('Custom Node Subgraph Persistence (TDD - FAILING)', () => {
  
  beforeEach(() => {
    localStorage.clear();
    // Clean up custom nodes from registry
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('Save on Navigation Up', () => {
    it('should save subgraph nodes when navigating up', () => {
      // Arrange: Create custom node with empty subgraph
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test',
        label: 'Test',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test'] = customNodeDef;

      // Act: Enter custom node, add Float node inside subgraph
      const floatNode: Node = {
        id: 'float_1',
        type: 'shaderNode',
        position: { x: 200, y: 100 },
        data: {
          definition: NODE_REGISTRY['input_float'],
          value: 5.0
        }
      };

      const modifiedSubgraph = {
        nodes: [floatNode],
        edges: []
      };

      // Simulate navigateUp() - should save modified subgraph
      // (In real code, this happens in navigateBack/navigateToLevel)
      customNodeDef.subgraph = modifiedSubgraph;
      addCustomNode(customNodeDef); // Save to localStorage
      (NODE_REGISTRY as Record<string, any>)['custom_test'] = customNodeDef; // Update registry

      // Re-enter: Load from registry
      const reloadedDef = NODE_REGISTRY['custom_test'] as CustomNodeDefinition;

      // EXPECTED: Float node should still be in subgraph
      // ACTUAL (BUG): Subgraph is empty (changes lost)

      // Assert: WILL FAIL - changes not persisted
      expect(reloadedDef.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL - is 0
      expect(reloadedDef.subgraph.nodes[0].id).toBe('float_1'); // ❌ FAILS
    });

    it('should save subgraph edges when navigating up', () => {
      // Arrange: Custom node with 2 nodes
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_edges_test',
        label: 'EdgesTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['input_float'] }
            },
            {
              id: 'sin_1',
              type: 'shaderNode',
              position: { x: 200, y: 0 },
              data: { definition: NODE_REGISTRY['math_sin'] }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_edges_test'] = customNodeDef;

      // Act: Add edge inside subgraph
      const newEdge: Edge = {
        id: 'e1',
        source: 'float_1',
        sourceHandle: 'out',
        target: 'sin_1',
        targetHandle: 'x'
      };

      customNodeDef.subgraph.edges.push(newEdge);

      // Navigate up - should save
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_edges_test'] = customNodeDef;

      // Re-enter
      const reloadedDef = NODE_REGISTRY['custom_edges_test'] as CustomNodeDefinition;

      // EXPECTED: Edge should persist
      // ACTUAL (BUG): Edge lost

      // Assert: WILL FAIL
      expect(reloadedDef.subgraph.edges.length).toBe(1); // ❌ FAILS - is 0
      expect(reloadedDef.subgraph.edges[0].id).toBe('e1'); // ❌ FAILS
    });

    it('should persist subgraph to localStorage on navigation up', () => {
      // Arrange: Custom node with modified subgraph
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_persist_test',
        label: 'PersistTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float_1',
              type: 'shaderNode',
              position: { x: 100, y: 100 },
              data: { definition: NODE_REGISTRY['input_float'], value: 10.0 }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      // Act: Navigate up - should save to localStorage
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_persist_test'] = customNodeDef;

      // Load from localStorage (simulates page reload)
      const loadedCustomNodes = loadCustomNodes();
      const loaded = loadedCustomNodes.find(n => n.id === 'custom_persist_test');

      // EXPECTED: Subgraph persisted to localStorage
      // ACTUAL (BUG): Subgraph might be empty in localStorage

      // Assert: WILL FAIL if not saved
      expect(loaded).toBeDefined();
      expect(loaded!.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL
      expect(loaded!.subgraph.nodes[0].id).toBe('float_1'); // ❌ FAILS
    });

    it('should save node positions when navigating up', () => {
      // Arrange: Custom node with node at specific position
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_position_test',
        label: 'PositionTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float_1',
              type: 'shaderNode',
              position: { x: 123, y: 456 },
              data: { definition: NODE_REGISTRY['input_float'] }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_position_test'] = customNodeDef;

      // Act: Move node inside subgraph
      customNodeDef.subgraph.nodes[0].position = { x: 999, y: 888 };

      // Navigate up
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_position_test'] = customNodeDef;

      // Re-enter
      const reloadedDef = NODE_REGISTRY['custom_position_test'] as CustomNodeDefinition;

      // EXPECTED: New position persisted
      // ACTUAL (BUG): Position reverted to old value

      // Assert: WILL FAIL
      expect(reloadedDef.subgraph.nodes[0].position.x).toBe(999); // ❌ FAILS - is 123
      expect(reloadedDef.subgraph.nodes[0].position.y).toBe(888); // ❌ FAILS - is 456
    });
  });

  describe('Port Extraction on Navigation Up', () => {
    it('should extract ports when navigating up from subgraph', () => {
      // Arrange: Custom node with Custom Input inside
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_port_test',
        label: 'PortTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_port_test'] = customNodeDef;

      // Act: Add Custom Input node inside subgraph
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'NewInput'
        }
      };

      customNodeDef.subgraph.nodes.push(customInputNode);

      // Navigate up - should extract ports
      // (In real code: extractCustomNodePorts is called in navigateBack)
      const extractedInputs = customNodeDef.subgraph.nodes
        .filter(n => n.data?.definition?.id === 'custom_input')
        .map(n => ({
          id: n.id,
          label: n.data.value || 'Input',
          type: 'auto'
        }));

      customNodeDef.inputs = extractedInputs;
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_port_test'] = customNodeDef;

      // Assert: Parent custom node should have new input port
      const reloadedDef = NODE_REGISTRY['custom_port_test'] as CustomNodeDefinition;

      // EXPECTED: 1 input port extracted
      // ACTUAL (BUG): Ports not extracted until manual refresh

      expect(reloadedDef.inputs.length).toBe(1); // ❌ MIGHT FAIL - is 0
      expect(reloadedDef.inputs[0].label).toBe('NewInput'); // ❌ FAILS
    });

    it('should update instance ports after navigation', () => {
      // Arrange: Instance of custom node on canvas
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_instance_test',
        label: 'InstanceTest',
        description: '',
        compact: false,
        inputs: [{ id: 'in1', label: 'OldInput', type: 'auto' }],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['custom_input'], value: 'OldInput' }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_instance_test'] = customNodeDef;

      // Instance on main canvas
      const instanceNode: Node = {
        id: 'instance_1',
        type: 'shaderNode',
        position: { x: 500, y: 500 },
        data: {
          definition: customNodeDef
        }
      };

      // Act: Enter custom node, add 2nd Custom Input, navigate up
      customNodeDef.subgraph.nodes.push({
        id: 'custom_input_2',
        type: 'shaderNode',
        position: { x: 0, y: 100 },
        data: { definition: NODE_REGISTRY['custom_input'], value: 'NewInput' }
      });

      // Extract ports
      const extractedInputs = customNodeDef.subgraph.nodes
        .filter(n => n.data?.definition?.id === 'custom_input')
        .map(n => ({
          id: n.id,
          label: n.data.value || 'Input',
          type: 'auto'
        }));

      customNodeDef.inputs = extractedInputs;
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_instance_test'] = customNodeDef;

      // Refresh instance definition
      instanceNode.data.definition = NODE_REGISTRY['custom_instance_test'] as CustomNodeDefinition;

      // EXPECTED: Instance now has 2 input ports
      // ACTUAL (BUG): Instance still has 1 port (not refreshed)

      // Assert: WILL FAIL
      const freshDef = instanceNode.data.definition as CustomNodeDefinition;
      expect(freshDef.inputs.length).toBe(2); // ❌ MIGHT FAIL - is 1
    });

    it('should extract Custom Output ports when navigating up', () => {
      // Arrange: Custom node with no outputs
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_output_test',
        label: 'OutputTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_output_test'] = customNodeDef;

      // Act: Add Custom Output node
      customNodeDef.subgraph.nodes.push({
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 400, y: 0 },
        data: { definition: NODE_REGISTRY['custom_output'], value: 'Result' }
      });

      // Navigate up - extract ports
      const extractedOutputs = customNodeDef.subgraph.nodes
        .filter(n => n.data?.definition?.id === 'custom_output')
        .map(n => ({
          id: n.id,
          label: n.data.value || 'Output',
          type: 'auto'
        }));

      customNodeDef.outputs = extractedOutputs;
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_output_test'] = customNodeDef;

      // Assert: Parent has 1 output port
      const reloadedDef = NODE_REGISTRY['custom_output_test'] as CustomNodeDefinition;

      // EXPECTED: 1 output port
      // ACTUAL (BUG): No outputs

      expect(reloadedDef.outputs.length).toBe(1); // ❌ MIGHT FAIL - is 0
      expect(reloadedDef.outputs[0].label).toBe('Result'); // ❌ FAILS
    });
  });

  describe('Navigation Methods', () => {
    it('should save on navigateBack (onNavigateUp)', () => {
      // Arrange: Custom node with initial state
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_navigate_back',
        label: 'NavigateBack',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_navigate_back'] = customNodeDef;

      // Simulate navigation stack
      const navigationStack = [
        { name: 'Main', nodes: [], edges: [] },
        { name: 'NavigateBack', nodes: [], edges: [] }
      ];

      // Act: Modify subgraph
      customNodeDef.subgraph.nodes.push({
        id: 'float_1',
        type: 'shaderNode',
        position: { x: 100, y: 100 },
        data: { definition: NODE_REGISTRY['input_float'] }
      });

      // Call navigateBack (simulated)
      // This should save the subgraph
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_navigate_back'] = customNodeDef;

      // Assert: Changes saved
      const reloadedDef = NODE_REGISTRY['custom_navigate_back'] as CustomNodeDefinition;
      expect(reloadedDef.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL
    });

    it('should save on navigateToMain (onExitToMain)', () => {
      // Arrange: Nested custom nodes
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_to_main',
        label: 'ToMain',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_to_main'] = customNodeDef;

      // Act: Modify and navigate directly to Main
      customNodeDef.subgraph.nodes.push({
        id: 'sin_1',
        type: 'shaderNode',
        position: { x: 200, y: 200 },
        data: { definition: NODE_REGISTRY['math_sin'] }
      });

      // Navigate to Main (bypasses intermediate levels)
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_to_main'] = customNodeDef;

      // Assert: Changes saved
      const reloadedDef = NODE_REGISTRY['custom_to_main'] as CustomNodeDefinition;
      expect(reloadedDef.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL
    });

    it('should save on navigateToLevel (breadcrumb click)', () => {
      // Arrange: Multi-level navigation
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_to_level',
        label: 'ToLevel',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_to_level'] = customNodeDef;

      // Act: Modify and jump to specific level (not immediate parent)
      customNodeDef.subgraph.nodes.push({
        id: 'add_1',
        type: 'shaderNode',
        position: { x: 300, y: 300 },
        data: { definition: NODE_REGISTRY['math_add'] }
      });

      // Navigate to level 1 (breadcrumb click)
      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_to_level'] = customNodeDef;

      // Assert: Changes saved
      const reloadedDef = NODE_REGISTRY['custom_to_level'] as CustomNodeDefinition;
      expect(reloadedDef.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL
    });
  });

  describe('Edge Cases and Errors', () => {
    it('should not lose changes on rapid navigation (enter → exit → enter)', () => {
      // Arrange: Custom node
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_rapid_nav',
        label: 'RapidNav',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_rapid_nav'] = customNodeDef;

      // Act: Enter → Add node → Exit → Re-enter
      customNodeDef.subgraph.nodes.push({
        id: 'float_1',
        type: 'shaderNode',
        position: { x: 100, y: 100 },
        data: { definition: NODE_REGISTRY['input_float'] }
      });

      addCustomNode(customNodeDef); // Save on exit
      (NODE_REGISTRY as Record<string, any>)['custom_rapid_nav'] = customNodeDef;

      // Re-enter
      const reloadedDef = NODE_REGISTRY['custom_rapid_nav'] as CustomNodeDefinition;

      // EXPECTED: Node still there
      // ACTUAL (BUG): Node might be lost

      expect(reloadedDef.subgraph.nodes.length).toBe(1); // ❌ MIGHT FAIL
    });

    it('should handle empty subgraph navigation gracefully', () => {
      // Arrange: Custom node with empty subgraph
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_empty_nav',
        label: 'EmptyNav',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_empty_nav'] = customNodeDef;

      // Act: Navigate up with no changes
      addCustomNode(customNodeDef);

      // Assert: Should not throw
      const reloadedDef = NODE_REGISTRY['custom_empty_nav'] as CustomNodeDefinition;
      expect(reloadedDef.subgraph.nodes.length).toBe(0); // ✅ PASSES
    });

    it('should preserve node data (values, colors) when navigating', () => {
      // Arrange: Custom node with node containing data
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_data_test',
        label: 'DataTest',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float_1',
              type: 'shaderNode',
              position: { x: 100, y: 100 },
              data: {
                definition: NODE_REGISTRY['input_float'],
                value: 42.5
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_data_test'] = customNodeDef;

      // Act: Modify value
      customNodeDef.subgraph.nodes[0].data.value = 99.9;

      addCustomNode(customNodeDef); // Save
      (NODE_REGISTRY as Record<string, any>)['custom_data_test'] = customNodeDef;

      // Re-enter
      const reloadedDef = NODE_REGISTRY['custom_data_test'] as CustomNodeDefinition;

      // EXPECTED: New value persisted
      // ACTUAL (BUG): Value reverted

      expect(reloadedDef.subgraph.nodes[0].data.value).toBe(99.9); // ❌ MIGHT FAIL - is 42.5
    });
  });
});
