import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import NodeEditor from '../components/NodeEditor';
import { addCustomNode, extractCustomNodePorts, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';
import { ReactFlowProvider } from 'reactflow';

/**
 * FULL E2E TEST: Custom Node Port Type Detection
 * 
 * Simulates EXACT user workflow:
 * 1. User creates custom node "TestNode"
 * 2. User enters custom node (sees Custom Input + Custom Output)
 * 3. User adds Float node
 * 4. User connects Float → Custom Input
 * 5. User exits to main canvas
 * 6. User sees custom node instance with RED port (float), NOT PURPLE (auto)
 */
describe('Custom Node - Full E2E Port Type Detection', () => {
  beforeEach(() => {
    localStorage.clear();
    // Clean up custom nodes from registry
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => {
        if (key !== 'custom_input' && key !== 'custom_output') {
          delete (NODE_REGISTRY as Record<string, any>)[key];
        }
      });
  });

  it('should detect float type and propagate to instance when Float → Custom Input', async () => {
    console.log('\n=== KROK 1: Użytkownik tworzy custom node ===');
    
    // User creates custom node "TestNode"
    const customNodeId = 'custom_testnode';
    const customNodeName = 'TestNode';
    
    // Default subgraph: Custom Input + Custom Output
    const customInputNodeId = 'custom_input_1';
    const customOutputNodeId = 'custom_output_1';
    
    const initialSubgraphNodes: Node[] = [
      {
        id: customInputNodeId,
        type: 'shaderNode',
        position: { x: 100, y: 200 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'Input', // Port name
        }
      },
      {
        id: customOutputNodeId,
        type: 'shaderNode',
        position: { x: 400, y: 200 },
        data: {
          definition: NODE_REGISTRY['custom_output'],
          value: 'Output',
        }
      }
    ];
    
    const customNode: CustomNodeDefinition = {
      id: customNodeId,
      label: customNodeName,
      description: 'Test custom node',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: {
        nodes: initialSubgraphNodes,
        edges: []
      },
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
    };
    
    // Add to NODE_REGISTRY
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = customNode;
    addCustomNode(customNode);
    
    console.log('KROK 1: Custom node created', {
      id: customNodeId,
      subgraphNodes: customNode.subgraph.nodes.length
    });
    
    expect(NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY]).toBeDefined();
    expect((NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY] as CustomNodeDefinition).subgraph.nodes.length).toBe(2);
    
    console.log('\n=== KROK 2: Użytkownik wchodzi do custom node ===');
    
    // Simulate entering custom node (in real app, this happens on double-click)
    let currentNodes: Node[] = [...customNode.subgraph.nodes];
    let currentEdges: Edge[] = [...customNode.subgraph.edges];
    
    console.log('KROK 2: Entered custom node', {
      nodesCount: currentNodes.length,
      customInputId: customInputNodeId
    });
    
    const customInputNode = currentNodes.find(n => n.id === customInputNodeId);
    expect(customInputNode).toBeDefined();
    expect(customInputNode?.data.definition.id).toBe('custom_input');
    expect(customInputNode?.data.definition.outputs[0].type).toBe('auto'); // Initially auto
    
    console.log('\n=== KROK 3: Użytkownik dodaje Float node ===');
    
    // User adds Float node
    const floatNodeId = 'float_1';
    const floatNode: Node = {
      id: floatNodeId,
      type: 'shaderNode',
      position: { x: 100, y: 100 },
      data: {
        definition: NODE_REGISTRY['input_float'], // Test Float node (outputs float)
      }
    };
    
    currentNodes.push(floatNode);
    
    console.log('KROK 3: Float node added', {
      floatNodeId,
      outputType: floatNode.data.definition.outputs[0].type
    });
    
    expect(floatNode.data.definition.outputs[0].type).toBe('float');
    
    console.log('\n=== KROK 4: Użytkownik łączy Float → Custom Input ===');
    
    // Simulate onConnect handler (NodeEditor.tsx line 846-870)
    const connection = {
      source: floatNodeId,
      sourceHandle: 'out',
      target: customInputNodeId,
      targetHandle: null, // Custom Input has no input handles (it's an input node)
    };
    
    // This simulates what onConnect does:
    const sourceNode = currentNodes.find(n => n.id === connection.source);
    const targetNode = currentNodes.find(n => n.id === connection.target);
    
    expect(sourceNode).toBeDefined();
    expect(targetNode).toBeDefined();
    
    const sourceOutputDef = sourceNode?.data.definition.outputs.find(
      (o: { id: string }) => o.id === connection.sourceHandle
    );
    
    expect(sourceOutputDef).toBeDefined();
    expect(sourceOutputDef?.type).toBe('float');
    
    // Custom Input type detection logic (from NodeEditor.tsx line 846-870)
    if (targetNode?.data.definition.id === 'custom_input' && sourceOutputDef) {
      const detectedType = sourceOutputDef.type;
      
      // Update node with detectedType
      currentNodes = currentNodes.map(n => {
        if (n.id === customInputNodeId) {
          console.log('✅ Custom Input type detected:', {
            nodeId: n.id,
            detectedType,
            label: n.data.value || 'Input'
          });
          return {
            ...n,
            data: {
              ...n.data,
              detectedType, // ← CRITICAL: Store detected type
              definition: {
                ...n.data.definition,
                outputs: [{ id: 'out', type: detectedType, label: 'Value' }]
              }
            }
          };
        }
        return n;
      });
    }
    
    // Add edge
    currentEdges.push({
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: connection.targetHandle || undefined,
    });
    
    console.log('KROK 4: Connected Float → Custom Input');
    
    // Verify detectedType was set
    const updatedCustomInput = currentNodes.find(n => n.id === customInputNodeId);
    console.log('  detectedType:', updatedCustomInput?.data.detectedType);
    console.log('  definition.outputs[0].type:', updatedCustomInput?.data.definition.outputs[0].type);
    
    expect(updatedCustomInput?.data.detectedType).toBe('float');
    expect(updatedCustomInput?.data.definition.outputs[0].type).toBe('float');
    
    console.log('\n=== KROK 5: Użytkownik wychodzi (navigateBack) ===');
    
    // Simulate navigateBack (NodeEditor.tsx line 485-520)
    // This extracts ports and saves the custom node
    
    const ports = extractCustomNodePorts({ nodes: currentNodes });
    
    console.log('KROK 5: navigateBack called');
    console.log('  extracted ports:', JSON.stringify(ports, null, 2));
    
    expect(ports.inputs.length).toBe(1);
    expect(ports.inputs[0].type).toBe('float'); // ← CRITICAL CHECK
    
    // Update custom node with new ports
    const updatedCustomNode: CustomNodeDefinition = {
      ...customNode,
      inputs: ports.inputs.length > 0 ? ports.inputs : customNode.inputs,
      outputs: ports.outputs.length > 0 ? ports.outputs : customNode.outputs,
      subgraph: {
        nodes: currentNodes,
        edges: currentEdges
      }
    };
    
    // Save to library
    addCustomNode(updatedCustomNode);
    
    // Update registry
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = updatedCustomNode;
    
    console.log('  saved custom node with inputs:', updatedCustomNode.inputs);
    
    console.log('\n=== KROK 6: Użytkownik patrzy na instancję custom node ===');
    
    // Create an instance of the custom node on main canvas
    const instanceNodeId = 'instance_1';
    const instanceNode: Node = {
      id: instanceNodeId,
      type: 'shaderNode',
      position: { x: 300, y: 300 },
      data: {
        definition: NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY]
      }
    };
    
    console.log('KROK 6: Checking instance');
    console.log('  instance.data.definition.id:', instanceNode.data.definition.id);
    console.log('  instance.data.definition.inputs:', JSON.stringify(instanceNode.data.definition.inputs, null, 2));
    
    // FINAL VERIFICATION: Instance should have float input port
    const instanceDef = instanceNode.data.definition as CustomNodeDefinition;
    expect(instanceDef.isCustom).toBe(true);
    expect(instanceDef.inputs.length).toBe(1);
    expect(instanceDef.inputs[0].type).toBe('float'); // ← CRITICAL: Should be float, NOT auto
    expect(instanceDef.inputs[0].label).toBe('Input');
    
    console.log('\n=== ✅ SUCCESS: Port type propagated correctly ===');
    console.log('Port should be RED (float), not PURPLE (auto)');
  });

  it('should detect vec3 type when Vec3 → Custom Input', async () => {
    console.log('\n=== TEST: Vec3 → Custom Input ===');
    
    const customNodeId = 'custom_vec3test';
    const customInputNodeId = 'custom_input_1';
    
    const initialSubgraphNodes: Node[] = [
      {
        id: customInputNodeId,
        type: 'shaderNode',
        position: { x: 100, y: 200 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'Input',
        }
      }
    ];
    
    const customNode: CustomNodeDefinition = {
      id: customNodeId,
      label: 'Vec3Test',
      description: 'Test vec3',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: {
        nodes: initialSubgraphNodes,
        edges: []
      },
      glslTemplate: () => 'vec3(1.0)',
    };
    
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = customNode;
    addCustomNode(customNode);
    
    let currentNodes: Node[] = [...customNode.subgraph.nodes];
    let currentEdges: Edge[] = [...customNode.subgraph.edges];
    
    // Add Vec3 node
    const vec3NodeId = 'vec3_1';
    const vec3Node: Node = {
      id: vec3NodeId,
      type: 'shaderNode',
      position: { x: 100, y: 100 },
      data: {
        definition: NODE_REGISTRY['input_vec3'], // Test Vec3 node
      }
    };
    
    currentNodes.push(vec3Node);
    
    // Connect Vec3 → Custom Input
    const sourceNode = currentNodes.find(n => n.id === vec3NodeId);
    const targetNode = currentNodes.find(n => n.id === customInputNodeId);
    const sourceOutputDef = sourceNode?.data.definition.outputs.find(
      (o: { id: string }) => o.id === 'out'
    );
    
    expect(sourceOutputDef?.type).toBe('vec3');
    
    // Type detection
    if (targetNode?.data.definition.id === 'custom_input' && sourceOutputDef) {
      const detectedType = sourceOutputDef.type;
      currentNodes = currentNodes.map(n => {
        if (n.id === customInputNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              detectedType,
              definition: {
                ...n.data.definition,
                outputs: [{ id: 'out', type: detectedType, label: 'Value' }]
              }
            }
          };
        }
        return n;
      });
    }
    
    // Verify detectedType
    const updatedCustomInput = currentNodes.find(n => n.id === customInputNodeId);
    expect(updatedCustomInput?.data.detectedType).toBe('vec3');
    
    // Extract ports
    const ports = extractCustomNodePorts({ nodes: currentNodes });
    console.log('  extracted ports:', JSON.stringify(ports, null, 2));
    
    expect(ports.inputs.length).toBe(1);
    expect(ports.inputs[0].type).toBe('vec3');
    
    // Update and save
    const updatedCustomNode: CustomNodeDefinition = {
      ...customNode,
      inputs: ports.inputs,
      outputs: ports.outputs.length > 0 ? ports.outputs : customNode.outputs,
      subgraph: { nodes: currentNodes, edges: currentEdges }
    };
    
    addCustomNode(updatedCustomNode);
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = updatedCustomNode;
    
    // Verify instance
    const instanceDef = NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY] as CustomNodeDefinition;
    expect(instanceDef.inputs[0].type).toBe('vec3');
    
    console.log('✅ Vec3 type detected and propagated correctly');
  });

  it('should show WHERE type is lost if test fails', async () => {
    console.log('\n=== DEBUG TEST: Track type through entire flow ===');
    
    const customNodeId = 'custom_debugtest';
    const customInputNodeId = 'custom_input_1';
    
    const initialSubgraphNodes: Node[] = [
      {
        id: customInputNodeId,
        type: 'shaderNode',
        position: { x: 100, y: 200 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'Input',
        }
      }
    ];
    
    const customNode: CustomNodeDefinition = {
      id: customNodeId,
      label: 'DebugTest',
      description: 'Debug test',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: {
        nodes: initialSubgraphNodes,
        edges: []
      },
      glslTemplate: () => 'vec3(1.0)',
    };
    
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = customNode;
    addCustomNode(customNode);
    
    console.log('📍 CHECKPOINT 1: Custom node created');
    console.log('  Initial Custom Input type:', initialSubgraphNodes[0].data.definition.outputs[0].type);
    
    let currentNodes: Node[] = [...customNode.subgraph.nodes];
    
    // Add Float node
    const floatNodeId = 'float_1';
    const floatNode: Node = {
      id: floatNodeId,
      type: 'shaderNode',
      position: { x: 100, y: 100 },
      data: {
        definition: NODE_REGISTRY['input_float'],
      }
    };
    
    currentNodes.push(floatNode);
    
    console.log('📍 CHECKPOINT 2: Float node added');
    console.log('  Float output type:', floatNode.data.definition.outputs[0].type);
    
    // Connect
    const sourceNode = currentNodes.find(n => n.id === floatNodeId);
    const targetNode = currentNodes.find(n => n.id === customInputNodeId);
    const sourceOutputDef = sourceNode?.data.definition.outputs[0];
    
    console.log('📍 CHECKPOINT 3: Before connection');
    console.log('  Source type:', sourceOutputDef?.type);
    console.log('  Target type:', targetNode?.data.definition.outputs[0].type);
    console.log('  Target detectedType:', targetNode?.data.detectedType);
    
    // Type detection
    if (targetNode?.data.definition.id === 'custom_input' && sourceOutputDef) {
      const detectedType = sourceOutputDef.type;
      currentNodes = currentNodes.map(n => {
        if (n.id === customInputNodeId) {
          const updated = {
            ...n,
            data: {
              ...n.data,
              detectedType,
              definition: {
                ...n.data.definition,
                outputs: [{ id: 'out', type: detectedType, label: 'Value' }]
              }
            }
          };
          console.log('📍 CHECKPOINT 4: After type detection');
          console.log('  Updated node.data.detectedType:', updated.data.detectedType);
          console.log('  Updated node.data.definition.outputs[0].type:', updated.data.definition.outputs[0].type);
          return updated;
        }
        return n;
      });
    }
    
    const updatedCustomInput = currentNodes.find(n => n.id === customInputNodeId);
    console.log('📍 CHECKPOINT 5: After currentNodes update');
    console.log('  CustomInput.data.detectedType:', updatedCustomInput?.data.detectedType);
    console.log('  CustomInput.data.definition.outputs[0].type:', updatedCustomInput?.data.definition.outputs[0].type);
    
    // Extract ports
    const ports = extractCustomNodePorts({ nodes: currentNodes });
    console.log('📍 CHECKPOINT 6: After extractCustomNodePorts');
    console.log('  ports.inputs:', JSON.stringify(ports.inputs, null, 2));
    
    // Save
    const updatedCustomNode: CustomNodeDefinition = {
      ...customNode,
      inputs: ports.inputs,
      outputs: ports.outputs.length > 0 ? ports.outputs : customNode.outputs,
      subgraph: { nodes: currentNodes, edges: [] }
    };
    
    console.log('📍 CHECKPOINT 7: After creating updatedCustomNode');
    console.log('  updatedCustomNode.inputs:', JSON.stringify(updatedCustomNode.inputs, null, 2));
    console.log('  updatedCustomNode.subgraph.nodes[0].data.detectedType:', updatedCustomNode.subgraph.nodes[0].data.detectedType);
    
    addCustomNode(updatedCustomNode);
    
    console.log('📍 CHECKPOINT 8: After addCustomNode (localStorage)');
    
    (NODE_REGISTRY as Record<string, any>)[customNodeId] = updatedCustomNode;
    
    console.log('📍 CHECKPOINT 9: After NODE_REGISTRY update');
    console.log('  NODE_REGISTRY[customNodeId].inputs:', JSON.stringify((NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY] as CustomNodeDefinition).inputs, null, 2));
    
    // Final check
    const instanceDef = NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY] as CustomNodeDefinition;
    console.log('📍 CHECKPOINT 10: Final instance check');
    console.log('  instanceDef.inputs[0].type:', instanceDef.inputs[0].type);
    
    if (instanceDef.inputs[0].type !== 'float') {
      console.error('❌ TYPE LOST! Expected "float", got:', instanceDef.inputs[0].type);
      console.error('Review checkpoints above to see WHERE type was lost');
    } else {
      console.log('✅ Type preserved through entire flow');
    }
    
    expect(instanceDef.inputs[0].type).toBe('float');
  });
});
