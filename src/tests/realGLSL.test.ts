/**
 * REAL COMPILATION TEST - z external input
 */
import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { type CustomNodeDefinition } from '../core/customNodeManager';

describe('REAL GLSL Compilation - Float → Custom Node', () => {
  it('Float → Custom Node (with float Custom Input) → Output', () => {
    console.log('\n🔥 REAL COMPILATION TEST\n');

    // Custom node z Custom Input (detectedType: float)
    const customNode: CustomNodeDefinition = {
      id: 'custom_floattest',
      label: 'FloatTest',
      isCustom: true,
      compact: false,
      inputs: [{ id: 'custom_input_1', label: 'FloatInput', type: 'float' }], // ← float!
      outputs: [{ id: 'custom_output_1', label: 'Output', type: 'vec3' }],
      glslTemplate: () => 'vec3(1.0)',
      subgraph: {
        nodes: [
          {
            id: 'custom_input_1',
            type: 'shaderNode',
            position: { x: 0, y: 0 },
            data: {
              definition: {
                ...NODE_REGISTRY['custom_input'],
                outputs: [{ id: 'out', type: 'float', label: 'Value' }]  // ← float!
              },
              value: 'FloatInput',
              detectedType: 'float'  // ← KRYTYCZNE!
            }
          },
          {
            id: 'math_add_1',
            type: 'shaderNode',
            position: { x: 200, y: 0 },
            data: {
              definition: NODE_REGISTRY['math_add']
            }
          },
          {
            id: 'custom_output_1',
            type: 'shaderNode',
            position: { x: 400, y: 0 },
            data: {
              definition: {
                ...NODE_REGISTRY['custom_output'],
                inputs: [{ id: 'in', type: 'vec3', label: 'Value' }]
              },
              value: 'Output',
              detectedType: 'vec3'
            }
          }
        ],
        edges: [
          {
            id: 'e1',
            source: 'custom_input_1',
            sourceHandle: 'out',
            target: 'math_add_1',
            targetHandle: 'a'
          },
          {
            id: 'e2',
            source: 'math_add_1',
            sourceHandle: 'result',
            target: 'custom_output_1',
            targetHandle: 'in'
          }
        ]
      }
    };

    // Main graph
    const nodes = [
      {
        id: 'float_1',
        type: 'shaderNode',
        data: {
          definition: NODE_REGISTRY['param_float'],
          value: 0.5
        }
      },
      {
        id: 'custom_instance',
        type: 'shaderNode',
        data: {
          definition: customNode
        }
      },
      {
        id: 'output_1',
        type: 'shaderNode',
        data: {
          definition: NODE_REGISTRY['output']
        }
      }
    ];

    const edges = [
      {
        id: 'e1',
        source: 'float_1',
        sourceHandle: 'value',
        target: 'custom_instance',
        targetHandle: 'custom_input_1'  // ← Float feeds into Custom Input
      },
      {
        id: 'e2',
        source: 'custom_instance',
        sourceHandle: 'custom_output_1',
        target: 'output_1',
        targetHandle: 'in'
      }
    ];

    console.log('Compiling graph: Float → Custom Node → Output\n');

    const glsl = compileGraphToGLSL(nodes as any, edges as any, 'output_1');

    console.log('=== FULL GLSL ===\n');
    console.log(glsl);
    console.log('\n=== END GLSL ===\n');

    // Extract lines 18-25 (critical area)
    const lines = glsl.split('\n');
    console.log('=== CRITICAL LINES (around custom node) ===');
    lines.slice(17, 26).forEach((line, i) => {
      console.log(`${18 + i}: ${line}`);
    });
    console.log('=== END CRITICAL ===\n');

    // Check for dimension mismatch
    const hasDimensionMismatch = glsl.toLowerCase().includes('dimension mismatch');
    
    if (hasDimensionMismatch) {
      console.error('❌ DIMENSION MISMATCH DETECTED in GLSL output!');
    } else {
      console.log('✅ No dimension mismatch in GLSL');
    }

    // Check precision count
    const precisionCount = (glsl.match(/precision mediump float/g) || []).length;
    console.log(`Precision count: ${precisionCount} (should be 1)`);

    expect(precisionCount).toBe(1);
    expect(hasDimensionMismatch).toBe(false);
  });
});
