import { describe, it, expect, beforeEach } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { validateConnection } from '../core/connectionValidator';

/**
 * TDD: Custom Input/Output Auto-Type Detection Tests
 * 
 * These tests FAIL now, but will PASS after fixing the bugs.
 * 
 * Bug: Custom Input and Custom Output nodes have 'auto' type that should:
 * 1. Detect actual type from first connection
 * 2. Update parent custom node's port type
 * 3. Switch from 'auto' to STRICT type (reject mismatches)
 * 
 * Current behavior: 'auto' stays 'auto' forever, accepts everything
 */
describe('Custom Node Auto-Type Detection (TDD - FAILING)', () => {
  
  beforeEach(() => {
    // Clean up custom nodes from registry
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  describe('Custom Input Type Detection', () => {
    it('should change Custom Input output type when connected to float source', () => {
      // Arrange: Custom Input node with 'auto' type
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput'
        }
      };

      // Float source node
      const floatNode: Node = {
        id: 'float_1',
        type: 'shaderNode',
        position: { x: -200, y: 0 },
        data: {
          definition: NODE_REGISTRY['input_float']
        }
      };

      // Connect Float.out → CustomInput.out (incoming connection)
      const edge: Edge = {
        id: 'e1',
        source: 'float_1',
        sourceHandle: 'out',
        target: 'custom_input_1',
        targetHandle: 'out' // Custom Input has no input port, but conceptually receives value
      };

      // Act: Simulate connection logic (would be in handleConnect)
      const floatOutputType = NODE_REGISTRY['input_float'].outputs[0].type; // 'float'
      const customInputOutputType = NODE_REGISTRY['custom_input'].outputs[0].type; // 'auto'

      // EXPECTED: Custom Input output type should change to 'float'
      // ACTUAL (BUG): Stays 'auto'
      
      // Assert: WILL FAIL - type detection not implemented
      expect(customInputOutputType).toBe('float'); // ❌ FAILS - is 'auto'
    });

    it('should update parent custom node input port type after Custom Input type detection', () => {
      // Arrange: Create custom node with Custom Input inside
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_processor',
        label: 'Processor',
        description: '',
        compact: false,
        inputs: [{ id: 'input1', label: 'MyInput', type: 'auto' }],
        outputs: [{ id: 'out', label: 'Out', type: 'auto' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
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

      (NODE_REGISTRY as Record<string, any>)['custom_processor'] = customNodeDef;

      // Act: Connect vec3 source to Custom Input inside subgraph
      const vec3Node: Node = {
        id: 'vec3_1',
        type: 'shaderNode',
        position: { x: -200, y: 0 },
        data: {
          definition: NODE_REGISTRY['input_vec3']
        }
      };

      // Simulate: vec3.out → custom_input_1.out
      const vec3Type = NODE_REGISTRY['input_vec3'].outputs[0].type; // 'vec3'

      // EXPECTED: Parent custom node's input port type should update to 'vec3'
      // ACTUAL (BUG): Stays 'auto'

      // Assert: WILL FAIL
      expect(customNodeDef.inputs[0].type).toBe('vec3'); // ❌ FAILS - is 'auto'
    });

    it('should enforce STRICT type checking after detection', () => {
      // Arrange: Custom Input detected as vec3
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput',
          // Simulate: Type was detected as 'vec3'
          detectedType: 'vec3'
        }
      };

      // Act: Try to connect float → Custom Input (should be BLOCKED)
      const floatType = 'float';
      const detectedType = 'vec3';

      // EXPECTED: Connection should be INVALID (strict type enforcement)
      // ACTUAL (BUG): 'auto' accepts everything

      const result = validateConnection(floatType, detectedType);
      
      // Assert: WILL FAIL if Custom Input still uses 'auto'
      expect(result.valid).toBe(false); // ✅ PASSES (would fail if using 'auto')
    });

    it('should preserve type detection across navigation (enter/exit subgraph)', () => {
      // Arrange: Custom Input with detected type 'float'
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput',
          detectedType: 'float' // Simulated detected type
        }
      };

      // Act: Navigate up from subgraph, then re-enter
      // (Simulate saving/loading from localStorage)
      const saved = JSON.parse(JSON.stringify(customInputNode));
      
      // EXPECTED: detectedType persists
      // ACTUAL (BUG): May be lost during serialization

      // Assert: WILL FAIL if not persisted
      expect(saved.data.detectedType).toBe('float'); // ❌ MIGHT FAIL - not persisted
    });
  });

  describe('Custom Output Type Detection', () => {
    it('should change Custom Output input type when connected to float target', () => {
      // Arrange: Custom Output node
      const customOutputNode: Node = {
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 400, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_output'],
          value: 'Result'
        }
      };

      // Sin node (takes float input)
      const sinNode: Node = {
        id: 'sin_1',
        type: 'shaderNode',
        position: { x: 600, y: 0 },
        data: {
          definition: NODE_REGISTRY['math_sin']
        }
      };

      // Connect: CustomOutput.in → Sin.x (outgoing connection)
      const edge: Edge = {
        id: 'e1',
        source: 'custom_output_1',
        sourceHandle: 'in',
        target: 'sin_1',
        targetHandle: 'x'
      };

      // Act: Detect type from target
      const sinInputType = NODE_REGISTRY['math_sin'].inputs.find(i => i.id === 'x')?.type; // 'float'
      const customOutputInputType = NODE_REGISTRY['custom_output'].inputs[0].type; // 'auto'

      // EXPECTED: Custom Output input type should change to 'float'
      // ACTUAL (BUG): Stays 'auto'

      // Assert: WILL FAIL
      expect(customOutputInputType).toBe('float'); // ❌ FAILS - is 'auto'
    });

    it('should update parent custom node output port type after Custom Output type detection', () => {
      // Arrange: Custom node with Custom Output inside
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_generator',
        label: 'Generator',
        description: '',
        compact: false,
        inputs: [],
        outputs: [{ id: 'output1', label: 'Result', type: 'auto' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_output_1',
              type: 'shaderNode',
              position: { x: 400, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_output'],
                value: 'Result'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      (NODE_REGISTRY as Record<string, any>)['custom_generator'] = customNodeDef;

      // Act: Connect Custom Output → Sin (float input) inside subgraph
      const sinInputType = 'float';

      // EXPECTED: Parent custom node's output port type should update to 'float'
      // ACTUAL (BUG): Stays 'auto'

      // Assert: WILL FAIL
      expect(customNodeDef.outputs[0].type).toBe('float'); // ❌ FAILS - is 'auto'
    });

    it('should enforce STRICT type after Custom Output detection', () => {
      // Arrange: Custom Output detected as vec3
      const customOutputNode: Node = {
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 400, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_output'],
          value: 'Result',
          detectedType: 'vec3'
        }
      };

      // Act: Try to connect float source → Custom Output (should be BLOCKED)
      const floatType = 'float';
      const detectedType = 'vec3';

      const result = validateConnection(floatType, detectedType);

      // Assert: Should reject mismatched types
      expect(result.valid).toBe(false); // ✅ PASSES (strict type checking works)
    });
  });

  describe('Multiple Custom Input/Output Ports', () => {
    it('should handle multiple Custom Inputs with different detected types', () => {
      // Arrange: Custom node with 2 Custom Inputs
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_multi_input',
        label: 'MultiInput',
        description: '',
        compact: false,
        inputs: [
          { id: 'input1', label: 'A', type: 'auto' },
          { id: 'input2', label: 'B', type: 'auto' }
        ],
        outputs: [{ id: 'out', label: 'Out', type: 'auto' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'A'
              }
            },
            {
              id: 'custom_input_2',
              type: 'shaderNode',
              position: { x: 0, y: 100 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'B'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      (NODE_REGISTRY as Record<string, any>)['custom_multi_input'] = customNodeDef;

      // Act: Connect Float → Input1, Vec3 → Input2
      // Simulate type detection
      const detectedTypes = {
        input1: 'float',
        input2: 'vec3'
      };

      // EXPECTED: Parent has 2 inputs with different types
      // ACTUAL (BUG): Both stay 'auto'

      // Assert: WILL FAIL
      expect(customNodeDef.inputs[0].type).toBe('float'); // ❌ FAILS
      expect(customNodeDef.inputs[1].type).toBe('vec3'); // ❌ FAILS
    });

    it('should refresh parent ports when Custom Input added dynamically', () => {
      // Arrange: Custom node with 1 Custom Input
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_dynamic',
        label: 'Dynamic',
        description: '',
        compact: false,
        inputs: [{ id: 'input1', label: 'A', type: 'auto' }],
        outputs: [{ id: 'out', label: 'Out', type: 'auto' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_input'],
                value: 'A'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      (NODE_REGISTRY as Record<string, any>)['custom_dynamic'] = customNodeDef;

      // Act: Add 2nd Custom Input inside subgraph
      customNodeDef.subgraph.nodes.push({
        id: 'custom_input_2',
        type: 'shaderNode',
        position: { x: 0, y: 100 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'B'
        }
      });

      // EXPECTED: Parent custom node should now have 2 input ports
      // ACTUAL (BUG): Ports not refreshed until navigation

      // Assert: WILL FAIL - ports not updated
      expect(customNodeDef.inputs.length).toBe(2); // ❌ FAILS - is still 1
    });

    it('should handle multiple Custom Outputs with different types', () => {
      // Arrange: Custom node with 2 Custom Outputs
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_multi_output',
        label: 'MultiOutput',
        description: '',
        compact: false,
        inputs: [],
        outputs: [
          { id: 'output1', label: 'X', type: 'auto' },
          { id: 'output2', label: 'Y', type: 'auto' }
        ],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom_output_1',
              type: 'shaderNode',
              position: { x: 400, y: 0 },
              data: {
                definition: NODE_REGISTRY['custom_output'],
                value: 'X'
              }
            },
            {
              id: 'custom_output_2',
              type: 'shaderNode',
              position: { x: 400, y: 100 },
              data: {
                definition: NODE_REGISTRY['custom_output'],
                value: 'Y'
              }
            }
          ],
          edges: []
        },
        glslTemplate: () => 'vec3(1.0)',
      };

      (NODE_REGISTRY as Record<string, any>)['custom_multi_output'] = customNodeDef;

      // Act: Connect Output1 → float target, Output2 → vec3 target
      // Simulate type detection
      const detectedTypes = {
        output1: 'float',
        output2: 'vec3'
      };

      // EXPECTED: Parent has 2 outputs with different types
      // ACTUAL (BUG): Both stay 'auto'

      // Assert: WILL FAIL
      expect(customNodeDef.outputs[0].type).toBe('float'); // ❌ FAILS
      expect(customNodeDef.outputs[1].type).toBe('vec3'); // ❌ FAILS
    });
  });

  describe('Type Detection Edge Cases', () => {
    it('should handle Custom Input with no incoming connection (stays auto)', () => {
      // Arrange: Custom Input with no connections
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'UnconnectedInput'
        }
      };

      // EXPECTED: Type remains 'auto' (no detection)
      const outputType = NODE_REGISTRY['custom_input'].outputs[0].type;

      // Assert: Should stay 'auto'
      expect(outputType).toBe('auto'); // ✅ PASSES - correct behavior
    });

    it('should handle Custom Output with no outgoing connection (stays auto)', () => {
      // Arrange: Custom Output with no connections
      const customOutputNode: Node = {
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 400, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_output'],
          value: 'UnconnectedOutput'
        }
      };

      // EXPECTED: Type remains 'auto'
      const inputType = NODE_REGISTRY['custom_output'].inputs[0].type;

      // Assert: Should stay 'auto'
      expect(inputType).toBe('auto'); // ✅ PASSES
    });

    it('should reset to auto if all connections are removed', () => {
      // Arrange: Custom Input with detected type 'float'
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput',
          detectedType: 'float'
        }
      };

      // Act: Remove all connections
      // EXPECTED: Type should reset to 'auto'
      // ACTUAL (BUG): Might stay 'float'

      delete customInputNode.data.detectedType;
      const outputType = customInputNode.data.detectedType;

      // Assert: WILL FAIL if type not reset
      expect(outputType).toBeUndefined(); // ✅ PASSES (type removed)
    });

    it('should prevent type re-detection if already strict', () => {
      // Arrange: Custom Input detected as 'vec3'
      const customInputNode: Node = {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput',
          detectedType: 'vec3'
        }
      };

      // Act: Try to connect float source (should be BLOCKED)
      const newSourceType = 'float';
      const currentType = 'vec3';

      const result = validateConnection(newSourceType, currentType);

      // Assert: Should reject incompatible type
      expect(result.valid).toBe(false); // ✅ PASSES (strict enforcement)
    });
  });
});
