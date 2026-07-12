import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { collectRuntimeResources, buildUniformDeclarations, FEEDBACK_UNIFORM } from '../core/runtimeResources';
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
  it('compiles to a texture2D sample of the feedback uniform', () => {
    const { nodes, edges } = outputGraph('feedback');
    const shader = compileGraphToGLSL(nodes, edges);

    expect(shader).toContain(`uniform sampler2D ${FEEDBACK_UNIFORM};`);
    expect(shader).toContain(`texture2D(${FEEDBACK_UNIFORM}, (uv * 0.5 + 0.5)).rgb`);
    expectValidGLSL(shader, 'feedback -> output');
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
