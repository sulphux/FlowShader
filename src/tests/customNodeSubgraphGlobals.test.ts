import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import type { Node } from 'reactflow';

/**
 * Regresja (zgłoszona na Examples/shader_graph.json / "BeautyNode"):
 * COMPILATION ERROR "'uv' : undeclared identifier" + "function return is not
 * matching type" po wczytaniu przykładu z custom nodem.
 *
 * Dwa błędy w generowaniu funkcji GLSL dla custom nodów:
 * 1. Szablony nodów typu UV Coord kompilują się do gołego identyfikatora
 *    `uv`, który był LOKALNĄ zmienną main() — wewnątrz wygenerowanej funkcji
 *    custom noda `uv` było niezadeklarowane. `uv`/`uv0` są teraz globalami
 *    przypisywanymi na początku main().
 * 2. Zadeklarowany typ zwracany funkcji (z portu wyjściowego ZEWNĘTRZNEGO
 *    noda, fallback vec3 przy 'auto') mógł się różnić od typu, który ciało
 *    faktycznie wyprodukowało (np. vec2 podpięty do Custom Output w środku)
 *    — "return is not matching type". Return jest teraz rzutowany do
 *    sygnatury przez autoCast.
 */

const glslangAvailable = hasGlslangValidator();

const expectValid = (shader: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, result.output).toBe(true);
};

describe('Custom node subgraphs using uv / mismatched output types', () => {
  it('a UV Coord node inside a subgraph compiles (uv visible at function scope)', () => {
    const customDef: CustomNodeDefinition = {
      id: 'custom_beautynode',
      label: 'BeautyNode',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [{ id: 'custom_input_default', label: 'Value', type: 'auto' }],
      outputs: [{ id: 'custom_output_default', label: 'Out', type: 'auto' }],
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
      subgraph: {
        nodes: [
          { id: 'custom_input_default', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
          { id: 'uv_in', type: 'shaderNode', position: { x: 0, y: 100 }, data: { definition: NODE_REGISTRY['uv'] } },
          { id: 'len1', type: 'shaderNode', position: { x: 150, y: 100 }, data: { definition: NODE_REGISTRY['vec_length'] } },
          { id: 'pal1', type: 'shaderNode', position: { x: 300, y: 100 }, data: { definition: NODE_REGISTRY['palette'] } },
          { id: 'custom_output_default', type: 'shaderNode', position: { x: 450, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } },
        ],
        edges: [
          { id: 'e0', source: 'uv_in', sourceHandle: 'out', target: 'len1', targetHandle: 'in' },
          { id: 'e1', source: 'len1', sourceHandle: 'out', target: 'pal1', targetHandle: 't' },
          { id: 'e2', source: 'pal1', sourceHandle: 'color', target: 'custom_output_default', targetHandle: 'in' },
        ],
      },
    };

    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'beauty1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
    ];
    const edges = [
      { source: 'uv1', sourceHandle: 'out', target: 'beauty1', targetHandle: 'custom_input_default' },
      { source: 'beauty1', sourceHandle: 'custom_output_default', target: 'out1', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);

    // uv/uv0 must be globals assigned in main, not locals declared there
    expect(shader).toMatch(/vec2 uv;\s*\n\s*vec2 uv0;/);
    expect(shader).toContain('uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;');
    expect(shader).not.toContain('vec2 uv = (gl_FragCoord.xy');

    expectValid(shader);
  });

  it('vec2 wired to Custom Output with the outer port still auto → return is cast to the vec3 signature', () => {
    const customOutputVec2 = {
      ...NODE_REGISTRY['custom_output'],
      inputs: [{ id: 'in', type: 'vec2', label: 'Value' }],
    };
    const customDef: CustomNodeDefinition = {
      id: 'custom_swirl',
      label: 'Swirl',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'custom_output_default', label: 'Out', type: 'auto' }],
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
      subgraph: {
        nodes: [
          { id: 'uv_in', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['uv'] } },
          { id: 'fr1', type: 'shaderNode', position: { x: 150, y: 0 }, data: { definition: NODE_REGISTRY['vec_fract'] } },
          { id: 'custom_output_default', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: customOutputVec2, detectedType: 'vec2' } },
        ],
        edges: [
          { id: 'e0', source: 'uv_in', sourceHandle: 'out', target: 'fr1', targetHandle: 'in' },
          { id: 'e1', source: 'fr1', sourceHandle: 'out', target: 'custom_output_default', targetHandle: 'in' },
        ],
      },
    };

    const nodes: GraphNode[] = [
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      { id: 'swirl1', type: 'shaderNode', data: { definition: customDef } },
    ];
    const edges = [
      { source: 'swirl1', sourceHandle: 'custom_output_default', target: 'out1', targetHandle: 'color' },
    ];

    const shader = compileGraphToGLSL(nodes, edges);

    // Body produces vec2; signature says vec3 — the return must bridge the gap
    expect(shader).toContain('return vec3(var_custom_output_default, 0.0);');

    expectValid(shader);
  });

  it('custom_input with a detected type survives a save → load roundtrip (var type matches template)', () => {
    // serializeGraph used to drop data.detectedType while keeping the adapted
    // port type in the definition. After reload the compiler declared the var
    // with the port type (float) but the template, seeing no detectedType,
    // emitted vec3(0.5): "cannot convert from vec3 to float". Found in the
    // real Examples/shader_graph.json (a subgraph saved to file from inside
    // a custom node).
    const detectedFloatInput = {
      ...NODE_REGISTRY['custom_input'],
      outputs: [{ id: 'out', type: 'float', label: 'Value' }],
    };
    const nodes: Node[] = [
      { id: 'ci1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: detectedFloatInput, detectedType: 'float', label: 'Amount' } },
      { id: 'sin1', type: 'shaderNode', position: { x: 150, y: 0 }, data: { definition: NODE_REGISTRY['math_sin'] } },
      { id: 'out1', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: NODE_REGISTRY['output'] } },
    ];
    const edges = [
      { id: 'e1', source: 'ci1', sourceHandle: 'out', target: 'sin1', targetHandle: 'in' },
      { id: 'e2', source: 'sin1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ];

    const roundtripped = rehydrateGraph(JSON.parse(JSON.stringify(serializeGraph(nodes, edges))));
    const shader = compileGraphToGLSL(
      roundtripped.nodes.map(n => ({ id: n.id, type: n.type || 'shaderNode', data: n.data })),
      roundtripped.edges
    );

    expect(shader).toContain('float var_ci1 = 0.0;');
    expect(shader).not.toContain('float var_ci1 = vec3(0.5);');
    expectValid(shader);
  });
});
