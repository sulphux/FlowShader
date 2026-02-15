import { describe, it, expect, beforeEach } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { addCustomNode, loadCustomNodes, extractCustomNodePorts } from '../core/customNodeManager';

/**
 * HARD E2E Tests for Custom Node Storage
 * 
 * These tests simulate the REAL flow:
 * 1. Create custom node
 * 2. Enter (load subgraph)
 * 3. Modify nodes/edges inside
 * 4. Exit (triggers save via navigateBack)
 * 5. Re-enter (reload from storage)
 * 6. VERIFY changes persisted
 * 
 * These tests MUST FAIL if the bug exists!
 */
describe('Custom Node Storage E2E - HARD Tests', () => {
  
  beforeEach(() => {
    localStorage.clear();
    // Clean up custom nodes from registry
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('1. Persistence after exit', () => {
    it('E2E: Node added inside should persist after exit', () => {
      // Step 1: Create custom node with empty subgraph
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_node_persist',
        label: 'TestNodePersist',
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
      (NODE_REGISTRY as Record<string, any>)['custom_test_node_persist'] = customNodeDef;

      // Step 2: Enter custom node (load subgraph into editor)
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Add Float node inside subgraph (user action)
      const floatNode: Node = {
        id: 'float-1',
        type: 'shaderNode',
        position: { x: 200, y: 100 },
        data: {
          definition: NODE_REGISTRY['input_float'],
          value: 5.0
        }
      };
      currentNodes.push(floatNode);

      // Step 4: Exit (triggers navigateBack - save to storage)
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_node_persist'] = updatedCustomNode;

      // Step 5: Re-load from storage (simulates re-entering or page reload)
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_node_persist');

      // Step 6: VERIFY - Float node should be there!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.nodes.length).toBe(1);
      expect(reloaded!.subgraph.nodes.find(n => n.id === 'float-1')).toBeDefined();
      expect(reloaded!.subgraph.nodes[0].data.value).toBe(5.0);
    });

    it('E2E: Edge added inside should persist after exit', () => {
      // Step 1: Create custom node with 2 nodes
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_edge_persist',
        label: 'TestEdgePersist',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['input_float'], value: 3.14 }
            },
            {
              id: 'sin-1',
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
      (NODE_REGISTRY as Record<string, any>)['custom_test_edge_persist'] = customNodeDef;

      // Step 2: Enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Add edge Float → Sin (user connects)
      const newEdge: Edge = {
        id: 'e-float-sin',
        source: 'float-1',
        sourceHandle: 'out',
        target: 'sin-1',
        targetHandle: 'x'
      };
      currentEdges.push(newEdge);

      // Step 4: Exit (save)
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_edge_persist'] = updatedCustomNode;

      // Step 5: Re-load
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_edge_persist');

      // Step 6: VERIFY - Edge should be there!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.edges.length).toBe(1);
      expect(reloaded!.subgraph.edges[0].id).toBe('e-float-sin');
      expect(reloaded!.subgraph.edges[0].source).toBe('float-1');
      expect(reloaded!.subgraph.edges[0].target).toBe('sin-1');
    });

    it('E2E: Node deleted inside should persist after exit', () => {
      // Step 1: Create custom node with 2 nodes
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_delete_persist',
        label: 'TestDeletePersist',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['input_float'] }
            },
            {
              id: 'float-2',
              type: 'shaderNode',
              position: { x: 0, y: 100 },
              data: { definition: NODE_REGISTRY['input_float'] }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_delete_persist'] = customNodeDef;

      // Step 2: Enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Delete float-2 (user deletes)
      currentNodes = currentNodes.filter(n => n.id !== 'float-2');

      // Step 4: Exit (save)
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_delete_persist'] = updatedCustomNode;

      // Step 5: Re-load
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_delete_persist');

      // Step 6: VERIFY - Only float-1 should remain!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.nodes.length).toBe(1);
      expect(reloaded!.subgraph.nodes[0].id).toBe('float-1');
      expect(reloaded!.subgraph.nodes.find(n => n.id === 'float-2')).toBeUndefined();
    });
  });

  describe('2. Type sync', () => {
    it('E2E: CustomInput type should sync to parent port after connection', () => {
      // Step 1: Create custom node with CustomInput
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_input_sync',
        label: 'TestInputSync',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'MyInput'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_input_sync'] = customNodeDef;

      // Step 2: Enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Add Float node and connect Float → CustomInput (onConnect sets detectedType)
      const floatNode: Node = {
        id: 'float-1',
        type: 'shaderNode',
        position: { x: -200, y: 0 },
        data: {
          definition: NODE_REGISTRY['input_float'],
          value: 1.0
        }
      };
      currentNodes.push(floatNode);

      const edge: Edge = {
        id: 'e1',
        source: 'float-1',
        sourceHandle: 'out',
        target: 'custom_input-1',
        targetHandle: 'in'
      };
      currentEdges.push(edge);

      // Simulate onConnect detection (from NodeEditor.tsx line 860)
      const sourceNode = currentNodes.find(n => n.id === 'float-1');
      const sourceType = sourceNode?.data?.definition?.outputs?.find((p: any) => p.id === 'out')?.type;
      const targetNode = currentNodes.find(n => n.id === 'custom_input-1');
      if (targetNode && sourceType) {
        targetNode.data.detectedType = sourceType; // 'float'
      }

      // Step 4: Exit (extractCustomNodePorts should read detectedType)
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_input_sync'] = updatedCustomNode;

      // Step 5: Check parent ports
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_input_sync');

      // Step 6: VERIFY - Input port should be 'float', not 'auto'!
      expect(reloaded).toBeDefined();
      expect(reloaded!.inputs.length).toBe(1);
      expect(reloaded!.inputs[0].label).toBe('MyInput');
      expect(reloaded!.inputs[0].type).toBe('float'); // ❌ CRITICAL TEST - should be 'float'!
    });

    it('E2E: CustomOutput type should sync to parent port', () => {
      // Step 1: Create custom node with CustomOutput
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_output_sync',
        label: 'TestOutputSync',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_output-1',
              type: 'shaderNode',
              position: { x: 400, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_output'],
                value: 'MyOutput'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_output_sync'] = customNodeDef;

      // Step 2: Enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Add Sin node and connect CustomOutput → Sin (sin input detects float)
      const sinNode: Node = {
        id: 'sin-1',
        type: 'shaderNode',
        position: { x: 200, y: 0 },
        data: {
          definition: NODE_REGISTRY['math_sin']
        }
      };
      currentNodes.push(sinNode);

      const edge: Edge = {
        id: 'e1',
        source: 'sin-1',
        sourceHandle: 'result',
        target: 'custom_output-1',
        targetHandle: 'in'
      };
      currentEdges.push(edge);

      // Simulate onConnect detection (target is custom_output)
      const sourceNode = currentNodes.find(n => n.id === 'sin-1');
      const sourceType = sourceNode?.data?.definition?.outputs?.find((p: any) => p.id === 'result')?.type;
      const targetNode = currentNodes.find(n => n.id === 'custom_output-1');
      if (targetNode && sourceType) {
        targetNode.data.detectedType = sourceType; // 'float'
      }

      // Step 4: Exit (extractCustomNodePorts should read detectedType)
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_output_sync'] = updatedCustomNode;

      // Step 5: Check parent ports
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_output_sync');

      // Step 6: VERIFY - Output port should be 'float', not 'auto'!
      expect(reloaded).toBeDefined();
      expect(reloaded!.outputs.length).toBe(1);
      expect(reloaded!.outputs[0].label).toBe('MyOutput');
      expect(reloaded!.outputs[0].type).toBe('float'); // ❌ CRITICAL TEST!
    });

    it('E2E: Multiple CustomInputs with different types', () => {
      // Step 1: Create custom node with 2 CustomInputs
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_multi_inputs',
        label: 'TestMultiInputs',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'InputA'
              }
            },
            {
              id: 'custom_input-2',
              type: 'shaderNode',
              position: { x: 0, y: 100 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'InputB'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_multi_inputs'] = customNodeDef;

      // Step 2: Enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      let currentEdges = [...customNodeDef.subgraph.edges];

      // Step 3: Connect Float → InputA, Vec3 → InputB
      const floatNode: Node = {
        id: 'float-1',
        type: 'shaderNode',
        position: { x: -200, y: 0 },
        data: { definition: NODE_REGISTRY['input_float'] }
      };
      const vec3Node: Node = {
        id: 'vec3-1',
        type: 'shaderNode',
        position: { x: -200, y: 100 },
        data: { definition: NODE_REGISTRY['input_vec3'] }
      };
      currentNodes.push(floatNode, vec3Node);

      currentEdges.push(
        { id: 'e1', source: 'float-1', sourceHandle: 'out', target: 'custom_input-1', targetHandle: 'in' },
        { id: 'e2', source: 'vec3-1', sourceHandle: 'out', target: 'custom_input-2', targetHandle: 'in' }
      );

      // Detect types
      const inputA = currentNodes.find(n => n.id === 'custom_input-1');
      const inputB = currentNodes.find(n => n.id === 'custom_input-2');
      if (inputA) inputA.data.detectedType = 'float';
      if (inputB) inputB.data.detectedType = 'vec3';

      // Step 4: Exit
      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updatedCustomNode: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: {
          nodes: currentNodes,
          edges: currentEdges
        }
      };
      addCustomNode(updatedCustomNode);
      (NODE_REGISTRY as Record<string, any>)['custom_test_multi_inputs'] = updatedCustomNode;

      // Step 5: Verify
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_multi_inputs');

      // Step 6: VERIFY - Both inputs with correct types!
      expect(reloaded).toBeDefined();
      expect(reloaded!.inputs.length).toBe(2);
      
      const inputAPort = reloaded!.inputs.find(i => i.label === 'InputA');
      const inputBPort = reloaded!.inputs.find(i => i.label === 'InputB');
      
      expect(inputAPort).toBeDefined();
      expect(inputAPort!.type).toBe('float'); // ❌ CRITICAL!
      
      expect(inputBPort).toBeDefined();
      expect(inputBPort!.type).toBe('vec3'); // ❌ CRITICAL!
    });
  });

  describe('3. Re-enter verification', () => {
    it('E2E: Re-entering custom node should show saved changes', () => {
      // Step 1: Create & save
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_reenter',
        label: 'TestReenter',
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
      (NODE_REGISTRY as Record<string, any>)['custom_test_reenter'] = customNodeDef;

      // Step 2: Enter → add node → exit
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes.push({
        id: 'sin-1',
        type: 'shaderNode',
        position: { x: 100, y: 100 },
        data: { definition: NODE_REGISTRY['math_sin'] }
      });

      const ports1 = extractCustomNodePorts({ nodes: currentNodes });
      const updated1: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports1.inputs.length > 0 ? ports1.inputs : customNodeDef.inputs,
        outputs: ports1.outputs.length > 0 ? ports1.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated1);
      (NODE_REGISTRY as Record<string, any>)['custom_test_reenter'] = updated1;

      // Step 3: RE-ENTER (load from registry)
      const reloadedDef = NODE_REGISTRY['custom_test_reenter'] as CustomNodeDefinition;
      let currentNodes2 = [...reloadedDef.subgraph.nodes];

      // Step 4: VERIFY - Sin node should still be there!
      expect(currentNodes2.length).toBe(1);
      expect(currentNodes2.find(n => n.id === 'sin-1')).toBeDefined();
    });

    it('E2E: Re-entering should preserve detectedTypes', () => {
      // Step 1: Create with CustomInput
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_preserve_type',
        label: 'TestPreserveType',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'Input'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_preserve_type'] = customNodeDef;

      // Step 2: Enter → connect (sets detectedType) → exit
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes.push({
        id: 'float-1',
        type: 'shaderNode',
        position: { x: -200, y: 0 },
        data: { definition: NODE_REGISTRY['input_float'] }
      });

      const inputNode = currentNodes.find(n => n.id === 'custom_input-1');
      if (inputNode) {
        inputNode.data.detectedType = 'float'; // Simulate onConnect
      }

      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updated: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_preserve_type'] = updated;

      // Step 3: RE-ENTER (from localStorage)
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_preserve_type');
      const inputNodeReloaded = reloaded!.subgraph.nodes.find(n => n.id === 'custom_input-1');

      // Step 4: VERIFY - detectedType preserved in node data!
      expect(inputNodeReloaded).toBeDefined();
      expect(inputNodeReloaded!.data.detectedType).toBe('float'); // ❌ CRITICAL - must persist!
    });
  });

  describe('4. localStorage consistency', () => {
    it('E2E: localStorage should match NODE_REGISTRY after exit', () => {
      // Step 1: Create & save
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_consistency',
        label: 'TestConsistency',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float-1',
              type: 'shaderNode',
              position: { x: 50, y: 50 },
              data: { definition: NODE_REGISTRY['input_float'], value: 42.0 }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_consistency'] = customNodeDef;

      // Step 2: Verify localStorage matches registry
      const fromStorage = loadCustomNodes().find(c => c.id === 'custom_test_consistency');
      const fromRegistry = NODE_REGISTRY['custom_test_consistency'] as CustomNodeDefinition;

      expect(fromStorage).toBeDefined();
      expect(fromStorage!.subgraph.nodes.length).toBe(fromRegistry.subgraph.nodes.length);
      expect(fromStorage!.subgraph.nodes[0].id).toBe(fromRegistry.subgraph.nodes[0].id);
      expect(fromStorage!.subgraph.nodes[0].data.value).toBe(42.0);
    });

    it('E2E: Changes should be loadable across page reload', () => {
      // Step 1: Create custom node with nodes inside
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_page_reload',
        label: 'TestPageReload',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'add-1',
              type: 'shaderNode',
              position: { x: 100, y: 100 },
              data: { definition: NODE_REGISTRY['math_add'] }
            },
            {
              id: 'mult-1',
              type: 'shaderNode',
              position: { x: 300, y: 100 },
              data: { definition: NODE_REGISTRY['math_mult'] }
            }
          ],
          edges: [
            { id: 'e1', source: 'add-1', sourceHandle: 'result', target: 'mult-1', targetHandle: 'a' }
          ]
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_page_reload'] = customNodeDef;

      // Step 2: Simulate page reload (clear registry, reload from localStorage)
      delete (NODE_REGISTRY as Record<string, any>)['custom_test_page_reload'];

      // Step 3: Reload from localStorage (like app init)
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_page_reload');

      // Step 4: Restore to registry
      if (reloaded) {
        (NODE_REGISTRY as Record<string, any>)[reloaded.id] = reloaded;
      }

      // Step 5: VERIFY - Everything loaded!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.nodes.length).toBe(2);
      expect(reloaded!.subgraph.edges.length).toBe(1);
      expect(reloaded!.subgraph.nodes.find(n => n.id === 'add-1')).toBeDefined();
      expect(reloaded!.subgraph.nodes.find(n => n.id === 'mult-1')).toBeDefined();
      expect(reloaded!.subgraph.edges[0].source).toBe('add-1');
      expect(reloaded!.subgraph.edges[0].target).toBe('mult-1');
    });
  });

  describe('5. Node positions and data preservation', () => {
    it('E2E: Node positions should persist after exit and re-enter', () => {
      // Step 1: Create with node at specific position
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_positions',
        label: 'TestPositions',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float-1',
              type: 'shaderNode',
              position: { x: 123, y: 456 },
              data: { definition: NODE_REGISTRY['input_float'], value: 1.0 }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_positions'] = customNodeDef;

      // Step 2: Enter → move node → exit
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes[0].position = { x: 999, y: 888 };

      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updated: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_positions'] = updated;

      // Step 3: Re-enter
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_positions');

      // Step 4: VERIFY - New position persisted!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.nodes[0].position.x).toBe(999);
      expect(reloaded!.subgraph.nodes[0].position.y).toBe(888);
    });

    it('E2E: Node data (values) should persist after exit and re-enter', () => {
      // Step 1: Create with node with value
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_values',
        label: 'TestValues',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'float-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['input_float'], value: 10.5 }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_values'] = customNodeDef;

      // Step 2: Enter → change value → exit
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes[0].data.value = 99.99;

      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updated: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_values'] = updated;

      // Step 3: Re-enter
      const reloaded = loadCustomNodes().find(c => c.id === 'custom_test_values');

      // Step 4: VERIFY - New value persisted!
      expect(reloaded).toBeDefined();
      expect(reloaded!.subgraph.nodes[0].data.value).toBe(99.99);
    });
  });

  describe('6. Complex workflow scenarios', () => {
    it('E2E: Full workflow - create, modify, exit, re-enter, modify again', () => {
      // Round 1: Create → add Float → exit
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_full_workflow',
        label: 'TestFullWorkflow',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_full_workflow'] = customNodeDef;

      // Enter → add Float
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes.push({
        id: 'float-1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY['input_float'], value: 1.0 }
      });

      // Exit
      let ports = extractCustomNodePorts({ nodes: currentNodes });
      let updated: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_full_workflow'] = updated;

      // Verify Round 1
      let reloaded1 = loadCustomNodes().find(c => c.id === 'custom_test_full_workflow');
      expect(reloaded1!.subgraph.nodes.length).toBe(1);

      // Round 2: Re-enter → add Sin → exit
      const def2 = NODE_REGISTRY['custom_test_full_workflow'] as CustomNodeDefinition;
      currentNodes = [...def2.subgraph.nodes];
      currentNodes.push({
        id: 'sin-1',
        type: 'shaderNode',
        position: { x: 200, y: 0 },
        data: { definition: NODE_REGISTRY['math_sin'] }
      });

      // Exit
      ports = extractCustomNodePorts({ nodes: currentNodes });
      updated = {
        ...def2,
        inputs: ports.inputs.length > 0 ? ports.inputs : def2.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : def2.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_full_workflow'] = updated;

      // Verify Round 2 - BOTH nodes should be there!
      const reloaded2 = loadCustomNodes().find(c => c.id === 'custom_test_full_workflow');
      expect(reloaded2!.subgraph.nodes.length).toBe(2);
      expect(reloaded2!.subgraph.nodes.find(n => n.id === 'float-1')).toBeDefined();
      expect(reloaded2!.subgraph.nodes.find(n => n.id === 'sin-1')).toBeDefined();
    });

    it('E2E: Rapid enter-exit-enter should not lose data', () => {
      // Create
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test_rapid',
        label: 'TestRapid',
        description: '',
        compact: false,
        inputs: [],
        outputs: [],
        isCustom: true,
        subgraph: { nodes: [], edges: [] },
        glslTemplate: () => 'vec3(1.0)',
      };

      addCustomNode(customNodeDef);
      (NODE_REGISTRY as Record<string, any>)['custom_test_rapid'] = customNodeDef;

      // Enter → add → exit → IMMEDIATELY re-enter
      let currentNodes = [...customNodeDef.subgraph.nodes];
      currentNodes.push({
        id: 'vec3-1',
        type: 'shaderNode',
        position: { x: 50, y: 50 },
        data: { definition: NODE_REGISTRY['input_vec3'] }
      });

      const ports = extractCustomNodePorts({ nodes: currentNodes });
      const updated: CustomNodeDefinition = {
        ...customNodeDef,
        inputs: ports.inputs.length > 0 ? ports.inputs : customNodeDef.inputs,
        outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
        subgraph: { nodes: currentNodes, edges: [] }
      };
      addCustomNode(updated);
      (NODE_REGISTRY as Record<string, any>)['custom_test_rapid'] = updated;

      // Immediately re-enter
      const def2 = NODE_REGISTRY['custom_test_rapid'] as CustomNodeDefinition;
      const nodesAfterReenter = [...def2.subgraph.nodes];

      // VERIFY - Node should still be there!
      expect(nodesAfterReenter.length).toBe(1);
      expect(nodesAfterReenter.find(n => n.id === 'vec3-1')).toBeDefined();
    });
  });
});
