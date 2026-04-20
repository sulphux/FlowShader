import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import type { GraphNode } from '../core/compiler';
import { CustomInputNode } from '../nodes/CustomInput';
import { CustomOutputNode } from '../nodes/CustomOutput';
import { AddNode } from '../nodes/math';
import { FloatNode } from '../nodes/params';
import { OutputNode } from '../nodes/OutputNode';

/**
 * Test that reproduces the REAL dimension mismatch error
 * that user is experiencing (lines 21-23 in GLSL output).
 */
describe('Dimension Mismatch Debug', () => {
  it('should show GLSL output for custom node with type conversions', () => {
    // CUSTOM NODE DEFINITION (subgraph)
    // Inside: CustomInput (float) → Math (converts to vec3) → CustomOutput (vec3)
    const customNodeDef = {
      id: 'custom_test',
      label: 'Test Custom Node',
      isCustom: true,
      compact: false,
      inputs: [{ id: 'input_1', type: 'float', label: 'Input' }],
      outputs: [{ id: 'output_1', type: 'vec3', label: 'Output' }],
      controls: null,
      description: 'Test node',
      glslTemplate: () => '', // Not used for custom nodes
      subgraph: {
        nodes: [
          {
            id: 'custom-input-1',
            type: 'custom_input',
            position: { x: 0, y: 0 },
            data: {
              definition: CustomInputNode,
              label: 'Input',
              detectedType: 'float' // User connected float to this
            }
          },
          {
            id: 'math-1',
            type: 'math_add',
            position: { x: 200, y: 0 },
            data: {
              definition: {
                ...AddNode,
                // Math node converts float → vec3
                inputs: [{ id: 'a', type: 'float', label: 'A' }],
                outputs: [{ id: 'result', type: 'vec3', label: 'Result' }]
              },
              value: 0.5
            }
          },
          {
            id: 'custom-output-1',
            type: 'custom_output',
            position: { x: 400, y: 0 },
            data: {
              definition: CustomOutputNode,
              label: 'Output',
              detectedType: 'vec3' // Outputs vec3
            }
          }
        ],
        edges: [
          // CustomInput → Math
          {
            id: 'e1',
            source: 'custom-input-1',
            target: 'math-1',
            sourceHandle: 'out',
            targetHandle: 'a'
          },
          // Math → CustomOutput
          {
            id: 'e2',
            source: 'math-1',
            target: 'custom-output-1',
            sourceHandle: 'result',
            targetHandle: 'in'
          }
        ]
      }
    };

    // MAIN GRAPH
    // Float node → CustomNode instance → Output
    const mainGraph = {
      nodes: [
        {
          id: 'float-1',
          type: 'float',
          position: { x: 0, y: 0 },
          data: {
            definition: FloatNode,
            value: 0.5
          }
        },
        {
          id: 'custom-instance-1',
          type: 'custom_test',
          position: { x: 200, y: 0 },
          data: {
            definition: customNodeDef
          }
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 400, y: 0 },
          data: {
            definition: OutputNode
          }
        }
      ] as GraphNode[],
      edges: [
        // Float → CustomNode.input_1
        {
          source: 'float-1',
          target: 'custom-instance-1',
          sourceHandle: 'value',
          targetHandle: 'input_1'
        },
        // CustomNode.output_1 → Output
        {
          source: 'custom-instance-1',
          target: 'output-1',
          sourceHandle: 'output_1',
          targetHandle: 'color'
        }
      ]
    };

    // COMPILE
    const glsl = compileGraphToGLSL(mainGraph.nodes, mainGraph.edges);

    // OUTPUT FOR DEBUGGING
    console.log('\n=== FULL GLSL OUTPUT ===\n');
    console.log(glsl);
    console.log('\n=== END GLSL ===\n');

    // ANALYZE LINES 21-23 (where user gets dimension mismatch)
    const lines = glsl.split('\n');
    console.log('\n=== LINES 18-25 (Critical area) ===');
    for (let i = 17; i < 25 && i < lines.length; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
    console.log('\n');

    // Check for dimension mismatch patterns
    const hasDimensionMismatch = 
      /float.*=.*vec3/.test(glsl) || 
      /vec3.*=.*float/.test(glsl);

    if (hasDimensionMismatch) {
      console.error('❌ DIMENSION MISMATCH DETECTED!');
      console.error('Found assignment between incompatible types');
    }

    expect(glsl).toContain('void main()');
  });

  it('should trace externalInput injection for Custom Input nodes', () => {
    // Simplified test - just show how externalInput works

    const customNodeDef = {
      id: 'custom_simple',
      label: 'Simple Custom',
      isCustom: true,
      compact: false,
      inputs: [{ id: 'in1', type: 'float', label: 'In' }],
      outputs: [{ id: 'out1', type: 'float', label: 'Out' }],
      controls: null,
      description: 'Test',
      glslTemplate: () => '',
      subgraph: {
        nodes: [
          {
            id: 'ci-1',
            type: 'custom_input',
            position: { x: 0, y: 0 },
            data: {
              definition: CustomInputNode,
              detectedType: 'float'
            }
          },
          {
            id: 'co-1',
            type: 'custom_output',
            position: { x: 200, y: 0 },
            data: {
              definition: CustomOutputNode,
              detectedType: 'float'
            }
          }
        ],
        edges: [
          {
            id: 'e1',
            source: 'ci-1',
            target: 'co-1',
            sourceHandle: 'out',
            targetHandle: 'in'
          }
        ]
      }
    };

    const mainGraph = {
      nodes: [
        {
          id: 'f1',
          type: 'float',
          position: { x: 0, y: 0 },
          data: {
            definition: FloatNode,
            value: 0.5
          }
        },
        {
          id: 'c1',
          type: 'custom_simple',
          position: { x: 200, y: 0 },
          data: {
            definition: customNodeDef
          }
        },
        {
          id: 'o1',
          type: 'output',
          position: { x: 400, y: 0 },
          data: {
            definition: OutputNode
          }
        }
      ] as GraphNode[],
      edges: [
        {
          source: 'f1',
          target: 'c1',
          sourceHandle: 'value',
          targetHandle: 'in1'
        },
        {
          source: 'c1',
          target: 'o1',
          sourceHandle: 'out1',
          targetHandle: 'color'
        }
      ]
    };

    const glsl = compileGraphToGLSL(mainGraph.nodes, mainGraph.edges);

    console.log('\n=== SIMPLE CUSTOM NODE GLSL ===\n');
    console.log(glsl);
    console.log('\n');

    expect(glsl).toContain('void main()');
  });
});
