import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileGraphToGLSL, compileGraphToGLSLWithReport } from './compiler';
import type { GraphNode } from './compiler';
import { NODE_REGISTRY } from '../nodes';
import type { CustomNodeDefinition } from './customNodeManager';
import { createShaderDebugLogger } from './shaderDebug';
import { createCompilerDebugReport, buildCompilerDebugSummary } from './compilerDebugReport';

describe('compiler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sortNodesTopologically', () => {
    it('should compile a simple float output', () => {
      const nodes: GraphNode[] = [
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        },
        {
          id: 'float-1',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 0.5 }
        }
      ];

      const edges = [
        {
          source: 'float-1',
          target: 'output-1',
          sourceHandle: 'value',
          targetHandle: 'color'
        }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('precision mediump float');
      expect(glsl).toContain('uniform float iTime');
      expect(glsl).toContain('uniform vec2 iResolution');
      expect(glsl).toContain('void main()');
      expect(glsl).toContain('gl_FragColor');
    });

    it('should handle disconnected output node', () => {
      const nodes: GraphNode[] = [
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const glsl = compileGraphToGLSL(nodes, []);

      expect(glsl).toContain('gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0)');
    });

    it('should compile math operations chain', () => {
      const nodes: GraphNode[] = [
        {
          id: 'float-1',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 2.0 }
        },
        {
          id: 'float-2',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 3.0 }
        },
        {
          id: 'add-1',
          type: 'math_add',
          data: { definition: NODE_REGISTRY.math_add }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'float-1', target: 'add-1', sourceHandle: 'value', targetHandle: 'a' },
        { source: 'float-2', target: 'add-1', sourceHandle: 'value', targetHandle: 'b' },
        { source: 'add-1', target: 'output-1', sourceHandle: 'result', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('var_float_1');
      expect(glsl).toContain('var_float_2');
      expect(glsl).toContain('var_add_1');
    });

    it('should handle type casting from vec2 to vec4', () => {
      const nodes: GraphNode[] = [
        {
          id: 'uv-1',
          type: 'uv',
          data: { definition: NODE_REGISTRY.uv }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'uv-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      // UV is vec2, so it should be cast to vec4 as vec4(uv, 0.0, 1.0)
      expect(glsl).toContain('gl_FragColor = vec4(var_uv_1, 0.0, 1.0)');
    });

    it('should handle swizzling operations', () => {
      const nodes: GraphNode[] = [
        {
          id: 'uv-1',
          type: 'uv',
          data: { definition: NODE_REGISTRY.uv }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'uv-1', target: 'output-1', sourceHandle: 'x', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('.x');
    });

    it('should handle float to vec3 casting', () => {
      const nodes: GraphNode[] = [
        {
          id: 'time-1',
          type: 'time',
          data: { definition: NODE_REGISTRY.time }
        },
        {
          id: 'color-add-1',
          type: 'color_add',
          data: { definition: NODE_REGISTRY.color_add }
        },
        {
          id: 'uv-1',
          type: 'uv',
          data: { definition: NODE_REGISTRY.uv }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'time-1', target: 'color-add-1', sourceHandle: 'time', targetHandle: 'a' },
        { source: 'uv-1', target: 'color-add-1', sourceHandle: 'uv', targetHandle: 'b' },
        { source: 'color-add-1', target: 'output-1', sourceHandle: 'result', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('vec3(');
    });

    it('should handle split node correctly', () => {
      const nodes: GraphNode[] = [
        {
          id: 'uv-1',
          type: 'uv',
          data: { definition: NODE_REGISTRY.uv }
        },
        {
          id: 'split-1',
          type: 'split_vec3',
          data: { definition: NODE_REGISTRY.split_vec3 }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'uv-1', target: 'split-1', sourceHandle: 'uv', targetHandle: 'vector' },
        { source: 'split-1', target: 'output-1', sourceHandle: 'x', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('vec3 var_split_1');
    });

    it('should compile to specific target node (monitor)', () => {
      const nodes: GraphNode[] = [
        {
          id: 'float-1',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 0.5 }
        },
        {
          id: 'monitor-1',
          type: 'monitor',
          data: { definition: NODE_REGISTRY.monitor }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'float-1', target: 'monitor-1', sourceHandle: 'value', targetHandle: 'value' },
        { source: 'float-1', target: 'output-1', sourceHandle: 'value', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges, 'monitor-1');

      expect(glsl).toContain('var_float_1');
      expect(glsl).not.toContain('var_output_1');
    });

    it('should handle complex graph with multiple paths', () => {
      const nodes: GraphNode[] = [
        {
          id: 'time-1',
          type: 'time',
          data: { definition: NODE_REGISTRY.time }
        },
        {
          id: 'sin-1',
          type: 'math_sin',
          data: { definition: NODE_REGISTRY.math_sin }
        },
        {
          id: 'cos-1',
          type: 'math_cos',
          data: { definition: NODE_REGISTRY.math_cos }
        },
        {
          id: 'add-1',
          type: 'math_add',
          data: { definition: NODE_REGISTRY.math_add }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'time-1', target: 'sin-1', sourceHandle: 'time', targetHandle: 'value' },
        { source: 'time-1', target: 'cos-1', sourceHandle: 'time', targetHandle: 'value' },
        { source: 'sin-1', target: 'add-1', sourceHandle: 'result', targetHandle: 'a' },
        { source: 'cos-1', target: 'add-1', sourceHandle: 'result', targetHandle: 'b' },
        { source: 'add-1', target: 'output-1', sourceHandle: 'result', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('var_time_1');
      expect(glsl).toContain('var_sin_1');
      expect(glsl).toContain('var_cos_1');
      expect(glsl).toContain('var_add_1');
    });

    it('should handle combine node operations', () => {
      const nodes: GraphNode[] = [
        {
          id: 'float-1',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 1.0 }
        },
        {
          id: 'float-2',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 0.5 }
        },
        {
          id: 'combine-1',
          type: 'combine_vec2',
          data: { definition: NODE_REGISTRY.combine_vec2 }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'float-1', target: 'combine-1', sourceHandle: 'value', targetHandle: 'x' },
        { source: 'float-2', target: 'combine-1', sourceHandle: 'value', targetHandle: 'y' },
        { source: 'combine-1', target: 'output-1', sourceHandle: 'vector', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('vec2(');
    });

    it('should include monitor node in compilation', () => {
      const nodes: GraphNode[] = [
        {
          id: 'float-1',
          type: 'param_float',
          data: { definition: NODE_REGISTRY.param_float, value: 1.0 }
        },
        {
          id: 'monitor-1',
          type: 'monitor',
          data: { definition: NODE_REGISTRY.monitor }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        { source: 'float-1', target: 'monitor-1', sourceHandle: 'out', targetHandle: 'value' },
        { source: 'float-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'color' }
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      // Monitor nodes ARE included in compilation (they have inputs and special handling)
      expect(glsl).toContain('var_monitor_1');
    });
  });

  describe('Custom Nodes Compilation', () => {
    it('should compile custom node without glslTemplate error', () => {
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_test',
        label: 'Test Custom',
        description: 'Test',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec2' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'uv-1',
              type: 'uv',
              data: { definition: NODE_REGISTRY.uv }
            },
            {
              id: 'custom-output-1',
              type: 'custom_output',
              data: {
                definition: NODE_REGISTRY.custom_output
              }
            }
          ],
          edges: [
            {
              source: 'uv-1',
              target: 'custom-output-1',
              sourceHandle: 'uv',
              targetHandle: 'in'
            }
          ]
        },
        glslTemplate: () => 'vec3(1.0, 0.0, 1.0)'
      };

      const nodes: GraphNode[] = [
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        },
        {
          id: 'custom-1',
          type: 'shaderNode',
          data: { definition: customNodeDef }
        }
      ];

      const edges = [
        {
          source: 'custom-1',
          target: 'output-1',
          sourceHandle: 'out',
          targetHandle: 'color'
        }
      ];

      expect(() => {
        compileGraphToGLSL(nodes, edges);
      }).not.toThrow();

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('gl_FragCoord');
      expect(glsl).toContain('iResolution');
    });

    it('should handle custom node with inputs via Custom Input injection', () => {
      const customNodeDef: CustomNodeDefinition = {
        id: 'custom_double',
        label: 'Double',
        description: 'Doubles input',
        compact: false,
        inputs: [{ id: 'in', label: 'In', type: 'float' }],
        outputs: [{ id: 'out', label: 'Out', type: 'float' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'custom-input-1',
              type: 'custom_input',
              data: { definition: NODE_REGISTRY.custom_input }
            },
            {
              id: 'mult-1',
              type: 'math_mult',
              data: {
                definition: NODE_REGISTRY.math_mult,
                value: 2.0
              }
            },
            {
              id: 'custom-output-1',
              type: 'custom_output',
              data: { definition: NODE_REGISTRY.custom_output }
            }
          ],
          edges: [
            {
              source: 'custom-input-1',
              target: 'mult-1',
              sourceHandle: 'out',
              targetHandle: 'a'
            },
            {
              source: 'mult-1',
              target: 'custom-output-1',
              sourceHandle: 'result',
              targetHandle: 'in'
            }
          ]
        },
        glslTemplate: () => 'vec3(1.0)'
      };

      const nodes: GraphNode[] = [
        {
          id: 'time-1',
          type: 'time',
          data: { definition: NODE_REGISTRY.time }
        },
        {
          id: 'custom-1',
          type: 'shaderNode',
          data: { definition: customNodeDef }
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output }
        }
      ];

      const edges = [
        {
          source: 'time-1',
          target: 'custom-1',
          sourceHandle: 'time',
          targetHandle: 'in'
        },
        {
          source: 'custom-1',
          target: 'output-1',
          sourceHandle: 'out',
          targetHandle: 'color'
        }
      ];

      expect(() => {
        compileGraphToGLSL(nodes, edges);
      }).not.toThrow();

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('*');
      expect(glsl).toContain('2.0');
    });

    it('should not emit debug logs when logger is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const logger = createShaderDebugLogger(false);

      logger.log('compiler', 'disabled message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should create compiler debug report summary', () => {
      const report = createCompilerDebugReport({
        nodes: [{ id: 'node-1', type: 'output', data: { definition: NODE_REGISTRY.output } }],
        edges: [],
        sortedNodes: [{ id: 'node-1', type: 'output', data: { definition: NODE_REGISTRY.output } }],
        generatedCustomNodeIds: ['custom_a'],
        skippedNodeIds: ['skip-a', 'skip-b'],
        targetNodeId: 'node-1',
        isSubgraph: false,
        finalLine: 'gl_FragColor = vec4(1.0);',
        shaderLength: 123,
      });

      expect(buildCompilerDebugSummary(report)).toContain('target=node-1');
      expect(buildCompilerDebugSummary(report)).toContain('customFunctions=1');
      expect(buildCompilerDebugSummary(report)).toContain('skipped=2');
    });

    it('should return compiler debug report with skipped custom node', () => {
      const brokenCustomNodeDef: CustomNodeDefinition = {
        id: 'custom_broken',
        label: 'Broken Custom',
        description: 'Missing custom output',
        compact: false,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        isCustom: true,
        subgraph: {
          nodes: [
            {
              id: 'uv-1',
              type: 'uv',
              data: { definition: NODE_REGISTRY.uv },
            },
          ],
          edges: [],
        },
        glslTemplate: () => 'vec3(0.0)',
      };

      const nodes: GraphNode[] = [
        {
          id: 'broken-custom-1',
          type: 'shaderNode',
          data: { definition: brokenCustomNodeDef },
        },
        {
          id: 'output-1',
          type: 'output',
          data: { definition: NODE_REGISTRY.output },
        },
      ];

      const edges = [
        {
          source: 'broken-custom-1',
          target: 'output-1',
          sourceHandle: 'out',
          targetHandle: 'color',
        },
      ];

      const result = compileGraphToGLSLWithReport(nodes, edges);

      expect(result.shader).toContain('gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0)');
      expect(result.debugReport.generatedCustomNodeIds).toEqual([]);
      expect(result.debugReport.skippedNodeIds).toContain('broken-custom-1');
      expect(result.debugReport.finalLine).toBe('gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);');
      expect(result.debugReport.sortedNodeIds).toEqual(['broken-custom-1', 'output-1']);
    });

    it('should emit structured debug logs when logger is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const logger = createShaderDebugLogger(true);

      logger.log('compiler', 'compiled shader', { nodes: 2 });

      expect(consoleSpy).toHaveBeenCalledWith('[ShaderDebug:compiler] compiled shader', { nodes: 2 });
    });
  });
});
