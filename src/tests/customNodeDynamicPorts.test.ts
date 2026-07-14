import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { loadCustomNodes, saveCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { validateWithGlslangValidator } from './utils/glslangValidate';

const graphNode = (id: string, definition: keyof typeof NODE_REGISTRY, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'shaderNode',
  position: { x: 0, y: 0 },
  data: { definition: NODE_REGISTRY[definition], ...data },
});

describe('dynamic ports inside saved custom nodes', () => {
  beforeEach(() => localStorage.clear());

  it('restores Code vec4 -> Auto Split -> Auto Compose vec2 and compiles it', () => {
    const outputDefinition = {
      ...NODE_REGISTRY.custom_output,
      inputs: [{ id: 'in', label: 'Value', type: 'vec2' }],
    };
    const subgraphNodes: Node[] = [
      graphNode('code', 'code_glsl', { value: 'vec4(a, b, c, d)' }),
      graphNode('split', 'smart_split', { forcedType: 'vec4' }),
      graphNode('compose', 'smart_compose'),
      { ...graphNode('result', 'custom_output'), data: { definition: outputDefinition, detectedType: 'vec2' } },
    ];
    const subgraphEdges: Edge[] = [
      { id: 'e1', source: 'code', sourceHandle: 'out', target: 'split', targetHandle: 'in' },
      { id: 'e2', source: 'split', sourceHandle: 'x', target: 'compose', targetHandle: 'x' },
      { id: 'e3', source: 'split', sourceHandle: 'y', target: 'compose', targetHandle: 'y' },
      { id: 'e4', source: 'compose', sourceHandle: 'out', target: 'result', targetHandle: 'in' },
    ];
    const custom: CustomNodeDefinition = {
      id: 'custom_noise_regression',
      label: 'Noise Regression',
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'result', label: 'Output', type: 'vec2' }],
      subgraph: { nodes: subgraphNodes, edges: subgraphEdges },
      glslTemplate: () => 'vec2(0.0)',
    };

    saveCustomNodes([custom]);
    const restored = loadCustomNodes()[0];
    expect(restored.subgraph.nodes.find(node => node.id === 'code')!.data.definition.outputs[0].type).toBe('vec4');
    expect(restored.subgraph.nodes.find(node => node.id === 'split')!.data.definition.outputs).toHaveLength(4);
    expect(restored.subgraph.nodes.find(node => node.id === 'compose')!.data.definition.outputs[0].type).toBe('vec2');

    const nodes: GraphNode[] = [
      { id: 'noise', type: 'shaderNode', data: { definition: restored } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'noise', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);
    const validation = validateWithGlslangValidator(shader, 'frag');
    expect(validation.ok, validation.output).toBe(true);
  });

  it('declares texture uniforms used only inside a custom node', () => {
    const resultDefinition = {
      ...NODE_REGISTRY.custom_output,
      inputs: [{ id: 'in', label: 'Value', type: 'vec3' }],
    };
    const textureCustom: CustomNodeDefinition = {
      id: 'custom_texture_regression',
      label: 'Nested Texture',
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'result', label: 'Output', type: 'vec3' }],
      subgraph: {
        nodes: [
          graphNode('nested-texture', 'texture_2d', { value: 'data:image/png;base64,abc' }),
          { ...graphNode('result', 'custom_output'), data: { definition: resultDefinition, detectedType: 'vec3' } },
        ],
        edges: [{ id: 'tex-out', source: 'nested-texture', sourceHandle: 'rgb', target: 'result', targetHandle: 'in' }],
      },
      glslTemplate: () => 'vec3(0.0)',
    };
    const nodes: GraphNode[] = [
      { id: 'nested', type: 'shaderNode', data: { definition: textureCustom } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'nested', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('uniform sampler2D u_tex_nested_texture;');
    const validation = validateWithGlslangValidator(shader, 'frag');
    expect(validation.ok, validation.output).toBe(true);
  });

  it('lets a forced custom output type override stale detectedType during compilation', () => {
    const resultDefinition = {
      ...NODE_REGISTRY.custom_output,
      inputs: [{ id: 'in', label: 'Value', type: 'float' }],
    };
    const custom: CustomNodeDefinition = {
      id: 'custom_forced_output_regression',
      label: 'Forced Output Regression',
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'result', label: 'Output', type: 'float' }],
      subgraph: {
        nodes: [
          graphNode('value', 'param_float', { value: 0.5 }),
          {
            ...graphNode('result', 'custom_output'),
            data: {
              definition: resultDefinition,
              forcedType: 'float',
              detectedType: 'vec2',
            },
          },
        ],
        edges: [{ id: 'value-out', source: 'value', sourceHandle: 'out', target: 'result', targetHandle: 'in' }],
      },
      glslTemplate: () => '0.0',
    };
    const nodes: GraphNode[] = [
      { id: 'forced', type: 'shaderNode', data: { definition: custom } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'forced', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('float var_result = var_value;');
    const validation = validateWithGlslangValidator(shader, 'frag');
    expect(validation.ok, validation.output).toBe(true);
  });
});
