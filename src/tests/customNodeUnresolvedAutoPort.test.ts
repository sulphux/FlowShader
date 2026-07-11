import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { CustomNodeDefinition } from '../core/customNodeManager';

/**
 * Regresja: Examples/shader_graph.json ("BeautyNode") — a custom node whose
 * Custom Input port was added but never wired to anything INSIDE the
 * subgraph. Type detection (NodeEditor.tsx onConnect) only fires on
 * connections made inside the subgraph, so the port's declared type stays
 * 'auto' forever. functionGenerator.ts's toGLSLType() falls back to vec3 for
 * the generated function *signature*, but autoCast() treated 'auto' as "no
 * cast needed" at the *call site* — so whatever actually got wired from
 * outside (a vec2 UV, a float param, ...) was passed raw into a vec3
 * parameter: "no matching overloaded function found". Separately, the final
 * gl_FragColor assignment had the same gap for an unresolved output port —
 * it silently fell back to solid black instead of the vec3 fallback used
 * everywhere else in the compiler.
 */

const glslangAvailable = hasGlslangValidator();

const beautyNodeDef = (): CustomNodeDefinition => ({
  id: 'custom_beautynode',
  label: 'BeautyNode',
  description: '',
  compact: false,
  isCustom: true,
  inputs: [
    { id: 'custom_input_default', label: 'Value', type: 'auto' },
    { id: 'custom_input_float', label: 'Value', type: 'auto' },
    { id: 'custom_input_color', label: 'Value', type: 'auto' },
  ],
  outputs: [{ id: 'custom_output_default', label: 'Out', type: 'auto' }],
  glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
  subgraph: {
    nodes: [
      { id: 'custom_input_default', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
      { id: 'custom_input_float', type: 'shaderNode', position: { x: 0, y: 100 }, data: { definition: NODE_REGISTRY['custom_input'] } },
      { id: 'custom_input_color', type: 'shaderNode', position: { x: 0, y: 200 }, data: { definition: NODE_REGISTRY['custom_input'] } },
      { id: 'custom_output_default', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } },
    ],
    // Only the first input is wired inside the subgraph. The other two —
    // and the output's own resolved type — are exactly what stays 'auto'
    // when a user adds ports and wires them from outside before ever using
    // them inside the subgraph body (the BeautyNode scenario).
    edges: [{ id: 'e1', source: 'custom_input_default', sourceHandle: 'out', target: 'custom_output_default', targetHandle: 'in' }],
  },
});

describe('Custom node with unresolved (auto) ports still compiles', () => {
  it('a vec2, a float, and a vec3 source all cast correctly into vec3 parameters', () => {
    const customDef = beautyNodeDef();
    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'beauty1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
      { id: 'pf1', type: 'shaderNode', data: { definition: NODE_REGISTRY['param_float'], value: 0.5 } },
      { id: 'pc1', type: 'shaderNode', data: { definition: NODE_REGISTRY['param_color'], value: '#000000' } },
    ];
    const edges = [
      { source: 'uv1', sourceHandle: 'out', target: 'beauty1', targetHandle: 'custom_input_default' },
      { source: 'pf1', sourceHandle: 'out', target: 'beauty1', targetHandle: 'custom_input_float' },
      { source: 'pc1', sourceHandle: 'rgb', target: 'beauty1', targetHandle: 'custom_input_color' },
      { source: 'beauty1', sourceHandle: 'custom_output_default', target: 'out1', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);

    // Call site casts must match the vec3 fallback in the generated signature
    expect(shader).toContain('custom_beautynode(vec3(var_uv1, 0.0), vec3(var_pf1), var_pc1)');
    // The result actually reaches the screen instead of defaulting to black
    expect(shader).toContain('gl_FragColor = vec4(var_beauty1, 1.0);');
    expect(shader).not.toContain('gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);');

    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, result.output).toBe(true);
    }
  });
});
