import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, compileNodeOutputToGLSL, type GraphNode } from '../core/compiler';
import { collectRuntimeResources, buildUniformDeclarations, FEEDBACK_UNIFORM, feedbackUniformName } from '../core/runtimeResources';
import { compileFeedbackPasses } from '../core/feedbackPasses';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

/**
 * Feedback (previous-frame texture), Impulse (periodic pulse) and Random
 * (optionally interval-held noise) — the primitives needed to build
 * persistent-state simulations like Conway's Game of Life. Feedback needs
 * engine support (ShaderPreview's ping-pong buffer, verified manually in the
 * browser — see the feature plan); Impulse/Random are pure iTime functions
 * and fully covered here.
 */

const glslangAvailable = hasGlslangValidator();

const expectValidGLSL = (shader: string, label: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${label}:\n${result.output}\n${shader}`).toBe(true);
};

const outputGraph = (sourceDefId: string, edgeOverrides: Partial<{ source: string; sourceHandle: string; target: string; targetHandle: string }> = {}): { nodes: GraphNode[]; edges: { source: string; sourceHandle: string; target: string; targetHandle: string }[] } => ({
  nodes: [
    { id: 'src1', type: 'shaderNode', data: { definition: NODE_REGISTRY[sourceDefId as keyof typeof NODE_REGISTRY] } },
    { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
  ],
  edges: [
    { source: 'src1', sourceHandle: NODE_REGISTRY[sourceDefId as keyof typeof NODE_REGISTRY].outputs[0].id, target: 'out1', targetHandle: 'color', ...edgeOverrides },
  ],
});

describe('collectRuntimeResources / buildUniformDeclarations: usesFeedback', () => {
  it('flags usesFeedback when a feedback node is present', () => {
    const { nodes } = outputGraph('feedback');
    const resources = collectRuntimeResources(nodes);
    expect(resources.usesFeedback).toBe(true);
  });

  it('does not flag usesFeedback for an unrelated graph', () => {
    const { nodes } = outputGraph('time');
    const resources = collectRuntimeResources(nodes);
    expect(resources.usesFeedback).toBe(false);
  });

  it('emits the sampler2D declaration only when usesFeedback is true', () => {
    expect(buildUniformDeclarations({ textures: [], usesAudio: false, usesFeedback: true }))
      .toContain(`uniform sampler2D ${FEEDBACK_UNIFORM};`);
    expect(buildUniformDeclarations({ textures: [], usesAudio: false, usesFeedback: false }))
      .not.toContain('u_feedback');
  });
});

describe('Feedback node', () => {
  it('exposes Image In, Snapshot and advanced Sample UV while keeping compatible port ids', () => {
    const { nodes, edges } = outputGraph('feedback');
    const shader = compileGraphToGLSL(nodes, edges);
    const uniform = feedbackUniformName('src1');

    expect(NODE_REGISTRY.feedback.inputs.map(input => input.id)).toEqual(['in', 'impulse', 'uv']);
    expect(NODE_REGISTRY.feedback.label).toBe('Frame Buffer');
    expect(NODE_REGISTRY.feedback.inputs.map(input => input.label)).toEqual(['Image In', 'Snapshot', 'Sample UV (Advanced)']);
    expect(NODE_REGISTRY.feedback.outputs[0].label).toBe('Stored Image');
    expect(shader).toContain(`uniform sampler2D ${uniform};`);
    expect(shader).toContain('vec2 screenUv;');
    expect(shader).toContain('screenUv = gl_FragCoord.xy / iResolution.xy;');
    expect(shader).toContain(`texture2D(${uniform}, screenUv).rgb`);
    expect(shader).not.toContain(`texture2D(${uniform}, (uv * 0.5 + 0.5)).rgb`);
    expectValidGLSL(shader, 'feedback -> output');
  });

  it('compiles a legal self-referential writer pass and snapshots every frame by default', () => {
    const feedback = { id: 'feedback-1', type: 'shaderNode', data: { definition: NODE_REGISTRY.feedback } } as GraphNode;
    const output = { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } } as GraphNode;
    const edges = [
      { source: 'feedback-1', sourceHandle: 'rgb', target: 'feedback-1', targetHandle: 'in' },
      { source: 'feedback-1', sourceHandle: 'rgb', target: 'out1', targetHandle: 'color' },
    ];

    const [pass] = compileFeedbackPasses([feedback, output], edges);
    expect(pass.uniform).toBe(feedbackUniformName('feedback-1'));
    expect(pass.shader).toContain('vec4(var_feedback_1, 0.0)');
    expect(pass.shader).not.toContain('var__');
    expectValidGLSL(pass.shader, 'self-referential feedback writer');
  });

  it('snapshots only on the rising edge and retains RGB for the rest of a wide pulse', () => {
    const nodes: GraphNode[] = [
      { id: 'color1', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_color, value: '#ff0000' } },
      { id: 'pulse1', type: 'shaderNode', data: { definition: NODE_REGISTRY.impulse } },
      { id: 'feedback1', type: 'shaderNode', data: { definition: NODE_REGISTRY.feedback } },
    ];
    const edges = [
      { source: 'color1', sourceHandle: 'out', target: 'feedback1', targetHandle: 'in' },
      { source: 'pulse1', sourceHandle: 'out', target: 'feedback1', targetHandle: 'impulse' },
    ];
    const [pass] = compileFeedbackPasses(nodes, edges);
    expect(pass.shader).toContain('step(0.000001, var_pulse1)');
    expect(pass.shader).toContain(`texture2D(${pass.uniform}, screenUv).a`);
    expect(pass.shader).toContain(`1.0 - step(0.000001, texture2D(${pass.uniform}, screenUv).a)`);
    expect(pass.shader).toContain(`vec4(mix(texture2D(${pass.uniform}, screenUv).rgb, var_color1`);
    expect(pass.shader).not.toContain(`texture2D(${pass.uniform}, (uv * 0.5 + 0.5))`);
    expect(pass.shader).toContain('var_color1');
    expectValidGLSL(pass.shader, 'impulse-gated feedback writer');
  });

  it('gives multiple Feedback nodes independent sampler uniforms and passes', () => {
    const nodes: GraphNode[] = ['a', 'b'].map(id => ({
      id, type: 'shaderNode', data: { definition: NODE_REGISTRY.feedback },
    }));
    const resources = collectRuntimeResources(nodes);
    const passes = compileFeedbackPasses(nodes, []);
    expect(resources.feedbacks?.map(item => item.uniform)).toEqual([feedbackUniformName('a'), feedbackUniformName('b')]);
    expect(passes.map(pass => pass.uniform)).toEqual([feedbackUniformName('a'), feedbackUniformName('b')]);
  });

  it('can compile its stored output directly for the toggleable node preview', () => {
    const buffer = { id: 'buffer1', type: 'shaderNode', data: { definition: NODE_REGISTRY.feedback } } as GraphNode;
    const shader = compileNodeOutputToGLSL([buffer], [], buffer.id, 'rgb');
    expect(shader).toContain(`texture2D(${feedbackUniformName(buffer.id)}, screenUv).rgb`);
    expect(shader).toContain('gl_FragColor = vec4(var_buffer1, 1.0);');
    expectValidGLSL(shader, 'Frame Buffer stored output preview');
  });
});

describe('random() helper injection', () => {
  it('is present in every compiled shader, unconditionally', () => {
    const { nodes, edges } = outputGraph('time');
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('float random(vec2 st)');
  });
});

describe('Random node (math_random)', () => {
  it('hashes off raw iTime when no interval is connected', () => {
    const { nodes, edges } = outputGraph('math_random');
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('random(uv + vec2(iTime))');
    expectValidGLSL(shader, 'math_random (no interval) -> output');
  });

  it('quantizes time via floor(iTime/interval) when interval is connected', () => {
    const nodes: GraphNode[] = [
      { id: 'p1', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_float, value: 0.5 } },
      { id: 'rnd1', type: 'shaderNode', data: { definition: NODE_REGISTRY.math_random } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const edges = [
      { source: 'p1', sourceHandle: 'out', target: 'rnd1', targetHandle: 'interval' },
      { source: 'rnd1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ];
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('floor(iTime / max(var_p1, 0.001))');
    expectValidGLSL(shader, 'math_random (with interval) -> output');
  });
});

describe('Impulse node', () => {
  it('compiles to a periodic pulse expression and defaults sanely when unconnected', () => {
    const { nodes, edges } = outputGraph('impulse');
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('mod(iTime, max(1.0, 0.001)) < (1.0 * 0.05)');
    expectValidGLSL(shader, 'impulse -> output');
  });

  it('uses connected interval/width instead of defaults', () => {
    const nodes: GraphNode[] = [
      { id: 'pi', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_float, value: 0.1 } },
      { id: 'imp1', type: 'shaderNode', data: { definition: NODE_REGISTRY.impulse } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const edges = [
      { source: 'pi', sourceHandle: 'out', target: 'imp1', targetHandle: 'interval' },
      { source: 'imp1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ];
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('mod(iTime, max(var_pi, 0.001)) < (var_pi * 0.05)');
    expectValidGLSL(shader, 'impulse (connected interval) -> output');
  });
});
