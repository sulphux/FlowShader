import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL, type GraphNode, type GraphEdge } from '../core/compiler';
import { getShaderValidationReport } from '../core/validator';
import { NODE_REGISTRY } from '../nodes';
import type { CustomNodeDefinition } from '../core/customNodeManager';

interface GraphRegressionFixture {
  name: string;
  build: () => { nodes: GraphNode[]; edges: GraphEdge[]; targetNodeId?: string };
  expectedShaderSnippets?: string[];
  forbiddenShaderPatterns?: RegExp[];
  expectedValid: boolean;
  expectedErrors?: string[];
  expectedWarnings?: string[];
}

const fixtures: GraphRegressionFixture[] = [
  {
    name: 'custom node with vec3 input and float output should emit an explicit cast path',
    build: () => {
      const customNode: CustomNodeDefinition = {
        id: 'graph_regression_vec3_to_float',
        label: 'Graph Regression Vec3 to Float',
        description: 'Casts vec3 custom input to float output',
        compact: false,
        isCustom: true,
        inputs: [{ id: 'input_1', label: 'Input', type: 'vec3' }],
        outputs: [{ id: 'output_1', label: 'Output', type: 'float' }],
        glslTemplate: () => '0.0',
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_input'],
                  outputs: [{ id: 'out', type: 'vec3', label: 'Value' }],
                },
                detectedType: 'vec3',
              },
            },
            {
              id: 'custom_output_1',
              type: 'shaderNode',
              position: { x: 200, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_output'],
                  inputs: [{ id: 'in', type: 'float', label: 'Value' }],
                },
                detectedType: 'float',
              },
            },
          ],
          edges: [
            {
              source: 'custom_input_1',
              sourceHandle: 'out',
              target: 'custom_output_1',
              targetHandle: 'in',
            },
          ],
        },
      };

      return {
        nodes: [
          { id: 'uv_1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
          { id: 'custom_1', type: 'shaderNode', data: { definition: customNode } },
          { id: 'output_1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
        ],
        edges: [
          { source: 'uv_1', sourceHandle: 'out', target: 'custom_1', targetHandle: 'input_1' },
          { source: 'custom_1', sourceHandle: 'output_1', target: 'output_1', targetHandle: 'in' },
        ],
        targetNodeId: 'output_1',
      };
    },
    expectedShaderSnippets: [
      'float graph_regression_vec3_to_float(vec3 input_1)',
      'float var_custom_output_1 = (custom_input_1).x;',
      'float var_custom_1 = graph_regression_vec3_to_float(vec3(var_uv_1, 0.0));',
    ],
    forbiddenShaderPatterns: [/float\s+var_custom_output_1\s*=\s*custom_input_1\s*;/],
    expectedValid: true,
  },
  {
    name: 'hyphenated custom node internals should be sanitized in compiled shader',
    build: () => {
      const customNode: CustomNodeDefinition = {
        id: 'graph_regression_hyphenated',
        label: 'Graph Regression Hyphenated',
        description: 'Sanitizes internal custom ids',
        compact: false,
        isCustom: true,
        inputs: [{ id: 'input-port', label: 'Input', type: 'float' }],
        outputs: [{ id: 'output-port', label: 'Output', type: 'float' }],
        glslTemplate: () => '0.0',
        subgraph: {
          nodes: [
            {
              id: 'custom-input-1',
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
              id: 'custom-output-1',
              type: 'shaderNode',
              position: { x: 200, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_output'],
                  inputs: [{ id: 'in', type: 'float', label: 'Value' }],
                },
                detectedType: 'float',
              },
            },
          ],
          edges: [
            {
              source: 'custom-input-1',
              sourceHandle: 'out',
              target: 'custom-output-1',
              targetHandle: 'in',
            },
          ],
        },
      };

      return {
        nodes: [
          { id: 'float_1', type: 'shaderNode', data: { definition: NODE_REGISTRY['param_float'], value: 0.25 } },
          { id: 'custom_1', type: 'shaderNode', data: { definition: customNode } },
          { id: 'output_1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
        ],
        edges: [
          { source: 'float_1', sourceHandle: 'value', target: 'custom_1', targetHandle: 'input-port' },
          { source: 'custom_1', sourceHandle: 'output-port', target: 'output_1', targetHandle: 'in' },
        ],
        targetNodeId: 'output_1',
      };
    },
    expectedShaderSnippets: [
      'float graph_regression_hyphenated(float input_port)',
      'float var_custom_output_1 = custom_input_1;',
    ],
    forbiddenShaderPatterns: [/custom-input-1/, /custom-output-1/],
    expectedValid: true,
  },
  {
    name: 'missing node definitions in graph should still produce a fallback shader',
    build: () => ({
      nodes: [
        {
          id: 'broken_output',
          type: 'shaderNode',
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            definition: null as any,
          },
        },
      ],
      edges: [],
      targetNodeId: 'broken_output',
    }),
    expectedShaderSnippets: [
      'precision mediump float;',
      'void main()',
      'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
    ],
    expectedValid: true,
  },
];

describe('Shader graph regression pack', () => {
  it.each(fixtures)('$name', ({ build, expectedShaderSnippets = [], forbiddenShaderPatterns = [], expectedValid, expectedErrors = [], expectedWarnings = [] }) => {
    const { nodes, edges, targetNodeId } = build();
    const shader = compileGraphToGLSL(nodes, edges, targetNodeId);
    const report = getShaderValidationReport(shader);

    expect(report.valid).toBe(expectedValid);

    for (const snippet of expectedShaderSnippets) {
      expect(shader).toContain(snippet);
    }

    for (const pattern of forbiddenShaderPatterns) {
      expect(shader).not.toMatch(pattern);
    }

    for (const expectedError of expectedErrors) {
      expect(report.errors.some(issue => issue.message.includes(expectedError))).toBe(true);
    }

    for (const expectedWarning of expectedWarnings) {
      expect(report.warnings.some(issue => issue.message.includes(expectedWarning))).toBe(true);
    }
  });

  it('should keep graph fixtures focused on distinct compiler failure classes', () => {
    expect(fixtures).toHaveLength(3);
    expect(fixtures.some(fixture => fixture.name.includes('vec3 input and float output'))).toBe(true);
    expect(fixtures.some(fixture => fixture.name.includes('hyphenated'))).toBe(true);
    expect(fixtures.some(fixture => fixture.name.includes('missing node definitions'))).toBe(true);
  });
});
