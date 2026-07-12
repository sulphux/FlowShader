import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { CustomNodeDefinition } from '../core/customNodeManager';

/**
 * Regresja: COMPILATION ERROR "'constructor' : not enough data provided for
 * construction" after loading a fresh project with a custom node that has
 * TWO Custom Output nodes in its subgraph (two exposed output ports of
 * different types, e.g. vec2 "Image Process OUT" + vec3 "Color OUT" — the
 * real BeautyNode from Examples/shader_graph.json).
 *
 * generateCustomNodeFunction always compiled the subgraph body against the
 * FIRST Custom Output node, but the OUTER instance still declared a second
 * output port whose type could differ. Any edge wired to that second port
 * called the SAME function (whose return type matched port 1) and then
 * autoCast the result to port 2's declared type — e.g. casting a vec3
 * return down to vec2 via `.xy` was fine syntactically, but the function's
 * actual returned VALUE was port 1's data reinterpreted as port 2, wrong at
 * best. Worse: nothing in the previous code path even reliably reproduced a
 * hard error until specific type/swizzle combinations lined up — this test
 * targets the general fix, not one specific crash string.
 *
 * A GLSL function returns exactly one value, so a custom node with N output
 * ports now compiles to N functions (customNodeFunctionName) — one per
 * port, each targeting that port's OWN Custom Output node — and the caller
 * declares one variable per port actually used (MultiOutputVarMap in
 * compiler.ts), instead of a single shared variable no swizzle could safely
 * split across unrelated types.
 */

const glslangAvailable = hasGlslangValidator();

const expectValid = (shader: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, result.output).toBe(true);
};

const twoOutputCustomDef = (): CustomNodeDefinition => ({
  id: 'custom_beautynode',
  label: 'BeautyNode',
  description: '',
  compact: false,
  isCustom: true,
  inputs: [],
  outputs: [
    { id: 'port_a', label: 'Image Process OUT', type: 'vec2' },
    { id: 'port_b', label: 'Color OUT', type: 'vec3' },
  ],
  glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
  subgraph: {
    nodes: [
      { id: 'uv_in', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['uv'] } },
      { id: 'fr1', type: 'shaderNode', position: { x: 150, y: 0 }, data: { definition: NODE_REGISTRY['vec_fract'] } },
      { id: 'port_a', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: 'vec2', label: 'Value' }] } } },
      { id: 'pal1', type: 'shaderNode', position: { x: 150, y: 150 }, data: { definition: NODE_REGISTRY['palette'] } },
      { id: 'port_b', type: 'shaderNode', position: { x: 300, y: 150 }, data: { definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: 'vec3', label: 'Value' }] } } },
    ],
    edges: [
      { id: 'e0', source: 'uv_in', sourceHandle: 'out', target: 'fr1', targetHandle: 'in' },
      { id: 'e1', source: 'fr1', sourceHandle: 'out', target: 'port_a', targetHandle: 'in' },
      { id: 'e2', source: 'pal1', sourceHandle: 'color', target: 'port_b', targetHandle: 'in' },
    ],
  },
});

describe('Custom node with multiple output ports', () => {
  it('wiring only the FIRST output to Output compiles', () => {
    const customDef = twoOutputCustomDef();
    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'beauty1', type: 'shaderNode', data: { definition: customDef } },
    ];
    const edges = [{ source: 'beauty1', sourceHandle: 'port_a', target: 'out1', targetHandle: 'color' }];

    const shader = compileGraphToGLSL(nodes, edges);
    expectValid(shader);
  });

  it('wiring only the SECOND output to Output compiles with the right vec3 value (not a reinterpreted vec2)', () => {
    const customDef = twoOutputCustomDef();
    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'beauty1', type: 'shaderNode', data: { definition: customDef } },
    ];
    const edges = [{ source: 'beauty1', sourceHandle: 'port_b', target: 'out1', targetHandle: 'color' }];

    const shader = compileGraphToGLSL(nodes, edges);
    // Must call a function whose body actually targets port_b's Custom Output
    // (the palette color), not port_a's (a completely different vec2 value)
    expect(shader).toContain('var_port_b = var_pal1;');
    expectValid(shader);
  });

  it('both outputs consumed simultaneously get independent, correctly-typed values', () => {
    const customDef = twoOutputCustomDef();
    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'beauty1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'mix1', type: 'shaderNode', data: { definition: NODE_REGISTRY['color_add'] } },
    ];
    const edges = [
      { source: 'beauty1', sourceHandle: 'port_a', target: 'mix1', targetHandle: 'a' },
      { source: 'beauty1', sourceHandle: 'port_b', target: 'mix1', targetHandle: 'b' },
      { source: 'mix1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);
    // Two distinct functions, one per port, each with its own call-site variable
    expect(shader).toMatch(/vec2 custom_beautynode\(/);
    expect(shader).toMatch(/vec3 custom_beautynode_o_port_b\(/);
    expect(shader).toContain('var_beauty1_o_port_a = custom_beautynode();');
    expect(shader).toContain('var_beauty1_o_port_b = custom_beautynode_o_port_b();');
    expectValid(shader);
  });
});
