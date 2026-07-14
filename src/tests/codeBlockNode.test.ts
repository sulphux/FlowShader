import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import type { ShaderNodeDefinition } from '../core/types';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { saveCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { validateWithGlslangValidator } from './utils/glslangValidate';

const validate = (shader: string) => {
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${result.output}\n${shader}`).toBe(true);
};

const blockDefinition = (
  inputs: ShaderNodeDefinition['inputs'],
  outputs: ShaderNodeDefinition['outputs'],
): ShaderNodeDefinition => ({ ...NODE_REGISTRY.code_block, inputs, outputs });

const customPortNode = (id: string, kind: 'custom_input' | 'custom_output', type: string): Node => ({
  id,
  type: 'shaderNode',
  position: { x: 0, y: 0 },
  data: {
    forcedType: type,
    definition: kind === 'custom_input'
      ? { ...NODE_REGISTRY.custom_input, outputs: [{ id: 'out', label: 'Value', type }] }
      : { ...NODE_REGISTRY.custom_output, inputs: [{ id: 'in', label: 'Value', type }] },
  },
});

describe('Code Block (GLSL)', () => {
  beforeEach(() => localStorage.clear());

  it('compiles a full statement body with local variables and return', () => {
    const nodes: GraphNode[] = [
      { id: 'position', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_color, value: '#808080' } },
      {
        id: 'map', type: 'shaderNode', data: {
          definition: blockDefinition(
            [{ id: 'p', label: 'p', type: 'vec3' }],
            [{ id: 'out', label: 'out', type: 'float' }],
          ),
          value: `
float d = (-length(p) + 3.0);
d = min(d, length(p) - 1.5);
float m = 1.5;
float s = 0.03;
d = min(d, max(abs(p.x) - s, abs(p.y + p.z * 0.2) - 0.07) - m * 0.0);
return d;`,
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'position', sourceHandle: 'out', target: 'map', targetHandle: 'p' },
      { source: 'map', sourceHandle: 'out', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('float code_block_map(vec3 p)');
    expect(shader).toContain('float var_map = code_block_map(var_position);');
    validate(shader);
  });

  it('compiles the GLSL ternary question-mark operator', () => {
    const nodes: GraphNode[] = [
      {
        id: 'ternary', type: 'shaderNode', data: {
          definition: blockDefinition([], [{ id: 'result', label: 'result', type: 'float' }]),
          value: 'return iTime > 1.0 ? 1.0 : 0.0;',
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'ternary', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('return iTime > 1.0 ? 1.0 : 0.0;');
    validate(shader);
  });

  it('calls another Code Block by its visible name from inside a loop', () => {
    const nodes: GraphNode[] = [
      {
        id: 'map-block', type: 'shaderNode', data: {
          definition: blockDefinition(
            [{ id: 'p', label: 'p', type: 'vec3' }],
            [{ id: 'distance', label: 'distance', type: 'float' }],
          ),
          label: 'Map',
          value: 'return length(p) - 1.0;',
        },
      },
      {
        id: 'raymarch-block', type: 'shaderNode', data: {
          definition: blockDefinition(
            [],
            [{ id: 'color', label: 'color', type: 'vec4' }],
          ),
          label: 'Raymarch',
          value: `
vec2 position = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
vec3 ray = normalize(vec3(position, 1.0));
float t = 0.0;
for (int r = 0; r < 16; r++) {
  vec3 p = vec3(0.0, 0.0, -3.0) + ray * t;
  float d = map(p);
  if (d < 0.01) break;
  t += d * 0.5;
}
return vec4(vec3(t / 8.0), 1.0);`,
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'raymarch-block', sourceHandle: 'color', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('float code_block_map_block(vec3 p)');
    expect(shader).toContain('float d = code_block_map_block(p);');
    expect(shader).not.toContain('float d = map(p);');
    validate(shader);
  });

  it('does not shadow GLSL built-ins with a Code Block title', () => {
    const nodes: GraphNode[] = [
      {
        id: 'fake-min', type: 'shaderNode', data: {
          definition: blockDefinition(
            [{ id: 'x', label: 'x', type: 'float' }],
            [{ id: 'out', label: 'out', type: 'float' }],
          ),
          label: 'Min',
          value: 'return x;',
        },
      },
      {
        id: 'caller', type: 'shaderNode', data: {
          definition: blockDefinition([], [{ id: 'out', label: 'out', type: 'float' }]),
          label: 'Caller',
          value: 'return min(1.0, 2.0);',
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'caller', sourceHandle: 'out', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('return min(1.0, 2.0);');
    expect(shader).not.toContain('return code_block_fake_min(1.0, 2.0);');
    validate(shader);
  });

  it('supports multiple independently typed outputs through GLSL out parameters', () => {
    const nodes: GraphNode[] = [
      { id: 'position', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_color, value: '#808080' } },
      {
        id: 'multi', type: 'shaderNode', data: {
          definition: blockDefinition(
            [{ id: 'p', label: 'p', type: 'vec3' }],
            [
              { id: 'distance', label: 'distance', type: 'float' },
              { id: 'color', label: 'color', type: 'vec3' },
            ],
          ),
          value: 'distance = length(p);\ncolor = normalize(p);',
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'position', sourceHandle: 'out', target: 'multi', targetHandle: 'p' },
      { source: 'multi', sourceHandle: 'color', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('void code_block_multi(vec3 p, out float distance, out vec3 color)');
    expect(shader).toContain('code_block_multi(var_position, var_multi_o_distance, var_multi_o_color);');
    validate(shader);
  });

  it('resolves Noise and Smin custom-node labels as callable GLSL functions', () => {
    const noise: CustomNodeDefinition = {
      id: 'custom_noise', label: 'Noise', isCustom: true,
      inputs: [{ id: 'p', label: 'p', type: 'vec3' }],
      outputs: [{ id: 'result', label: 'result', type: 'float' }],
      glslTemplate: () => '0.0',
      subgraph: {
        nodes: [customPortNode('p', 'custom_input', 'vec3'), customPortNode('result', 'custom_output', 'float')],
        edges: [{ id: 'noise-edge', source: 'p', sourceHandle: 'out', target: 'result', targetHandle: 'in' }],
      },
    };
    const smin: CustomNodeDefinition = {
      id: 'custom_smin', label: 'Smin', isCustom: true,
      inputs: [
        { id: 'a', label: 'a', type: 'float' },
        { id: 'b', label: 'b', type: 'float' },
        { id: 'k', label: 'k', type: 'float' },
      ],
      outputs: [{ id: 'result', label: 'result', type: 'float' }],
      glslTemplate: () => '0.0',
      subgraph: {
        nodes: [
          customPortNode('a', 'custom_input', 'float'),
          customPortNode('b', 'custom_input', 'float'),
          customPortNode('k', 'custom_input', 'float'),
          customPortNode('result', 'custom_output', 'float'),
        ],
        edges: [{ id: 'smin-edge', source: 'a', sourceHandle: 'out', target: 'result', targetHandle: 'in' }],
      },
    };
    const nodes: GraphNode[] = [
      { id: 'position', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_color, value: '#808080' } },
      {
        id: 'map', type: 'shaderNode', data: {
          definition: blockDefinition(
            [{ id: 'p', label: 'p', type: 'vec3' }],
            [{ id: 'out', label: 'out', type: 'float' }],
          ),
          value: `
// spheres
float d = (-1.0 * length(p) + 3.0) + 1.5 * noise(p);
d = min(d, (length(p) - 1.5) + 1.5 * noise(p));

// links
float m = 1.5;
float s = 0.03;
d = smin(d, max(abs(p.x) - s, abs(p.y + p.z * 0.2) - 0.07), m);
d = smin(d, max(abs(p.z) - s, abs(p.x + p.y / 2.0) - 0.07), m);
d = smin(d, max(abs(p.z - p.y * 0.4) - s, abs(p.x - p.y * 0.2) - 0.07), m);
d = smin(d, max(abs(p.z * 0.2 - p.y) - s, abs(p.x + p.z) - 0.07), m);
d = smin(d, max(abs(p.z * -0.2 + p.y) - s, abs(-p.x + p.z) - 0.07), m);
return d;`,
        },
      },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    saveCustomNodes([noise, smin]);
    const shader = compileGraphToGLSL(nodes, [
      { source: 'position', sourceHandle: 'out', target: 'map', targetHandle: 'p' },
      { source: 'map', sourceHandle: 'out', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('custom_noise(p)');
    expect(shader).toContain('custom_smin(d, max(abs(p.x)');
    validate(shader);
  });

  it('preserves dynamic ports through project serialization', () => {
    const definition = blockDefinition(
      [{ id: 'position', label: 'position', type: 'vec3' }, { id: 'time', label: 'time', type: 'float' }],
      [{ id: 'distance', label: 'distance', type: 'float' }, { id: 'color', label: 'color', type: 'vec3' }],
    );
    const nodes: Node[] = [{
      id: 'block', type: 'shaderNode', position: { x: 10, y: 20 },
      data: { definition, value: 'distance = length(position); color = position;' },
    }];
    const serialized = serializeGraph(nodes, []);
    const restored = rehydrateGraph(JSON.parse(JSON.stringify(serialized)));
    const restoredDef = restored.nodes[0].data.definition as ShaderNodeDefinition;

    expect(restoredDef.inputs).toEqual(definition.inputs);
    expect(restoredDef.outputs).toEqual(definition.outputs);
    expect(restored.nodes[0].data.value).toContain('distance = length(position)');
  });
});
