import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

/**
 * Regression: custom_output detectedType should influence the generated custom function return type.
 * This pins the compiler path that prioritizes node.data.detectedType for custom_output.
 */
describe('Custom Output detectedType - GLSL compile', () => {
  it('should compile when custom_output detectedType is vec3', () => {
    expect(hasGlslangValidator()).toBe(true);
    const customNode: CustomNodeDefinition = {
      id: 'custom_out_detect',
      label: 'OutDetect',
      isCustom: true,
      compact: false,
      inputs: [{ id: 'ci_1', label: 'In', type: 'float' }],
      outputs: [{ id: 'co_1', label: 'Out', type: 'vec3' }],
      glslTemplate: () => 'vec3(1.0)',
      subgraph: {
        nodes: [
          {
            id: 'ci_1',
            type: 'shaderNode',
            position: { x: 0, y: 0 },
            data: {
              definition: {
                ...NODE_REGISTRY['custom_input'],
                outputs: [{ id: 'out', type: 'float', label: 'Value' }],
              },
              detectedType: 'float',
            },
          },
          {
            id: 'add_1',
            type: 'shaderNode',
            position: { x: 200, y: 0 },
            data: { definition: NODE_REGISTRY['math_add'] },
          },
          {
            id: 'co_1',
            type: 'shaderNode',
            position: { x: 400, y: 0 },
            data: {
              definition: {
                ...NODE_REGISTRY['custom_output'],
                inputs: [{ id: 'in', type: 'vec3', label: 'Value' }],
              },
              detectedType: 'vec3',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'ci_1', sourceHandle: 'out', target: 'add_1', targetHandle: 'a' },
          { id: 'e2', source: 'add_1', sourceHandle: 'result', target: 'co_1', targetHandle: 'in' },
        ],
      },
    };

    const nodes = [
      {
        id: 'float_1',
        type: 'shaderNode',
        data: { definition: NODE_REGISTRY['param_float'], value: 0.5 },
      },
      {
        id: 'custom_instance',
        type: 'shaderNode',
        data: { definition: customNode },
      },
      {
        id: 'output_1',
        type: 'shaderNode',
        data: { definition: NODE_REGISTRY['output'] },
      },
    ];

    const edges = [
      { id: 'm1', source: 'float_1', sourceHandle: 'value', target: 'custom_instance', targetHandle: 'ci_1' },
      { id: 'm2', source: 'custom_instance', sourceHandle: 'co_1', target: 'output_1', targetHandle: 'in' },
    ];

    const glsl = compileGraphToGLSL(nodes as any, edges as any, 'output_1');
    expect(glsl).toContain('vec3 custom_out_detect');
    expect(glsl).toContain('float ci_1');

    const res = validateWithGlslangValidator(glsl, 'frag');
    if (!res.ok) {
      // Print validator output to debug why GLSL is rejected
      // (usually identifier naming / GLSL dialect mismatch)
      console.log(res.output);
    }
    expect(res.ok).toBe(true);
  });
});
