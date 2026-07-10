import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import {
  collectRuntimeResources,
  buildUniformDeclarations,
  textureUniformName,
  AUDIO_UNIFORMS,
} from '../core/runtimeResources';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';

const glslangAvailable = hasGlslangValidator();

const expectValidGLSL = (shader: string, label: string) => {
  if (!glslangAvailable) return;
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${label}:\n${result.output}\n${shader}`).toBe(true);
};

describe('Texture node (texture_2d)', () => {
  const textureGraph = (): { nodes: GraphNode[]; edges: { source: string; sourceHandle: string; target: string; targetHandle: string }[] } => ({
    nodes: [
      { id: 'tex-1', type: 'shaderNode', data: { definition: NODE_REGISTRY.texture_2d, value: 'data:image/png;base64,abc' } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ],
    edges: [
      { source: 'tex-1', sourceHandle: 'rgb', target: 'out1', targetHandle: 'color' },
    ],
  });

  it('sanitizes node id into a valid GLSL uniform name', () => {
    expect(textureUniformName('tex-1')).toBe('u_tex_tex_1');
    expect(textureUniformName('texture_2d_123')).toBe('u_tex_texture_2d_123');
  });

  it('compiler declares the sampler2D uniform and samples it', () => {
    const { nodes, edges } = textureGraph();
    const shader = compileGraphToGLSL(nodes, edges);

    expect(shader).toContain('uniform sampler2D u_tex_tex_1;');
    expect(shader).toContain('texture2D(u_tex_tex_1, (uv * 0.5 + 0.5)).rgb');
    expectValidGLSL(shader, 'texture graph');
  });

  it('uses connected UV input instead of the default screen UV', () => {
    const nodes: GraphNode[] = [
      { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY.uv } },
      { id: 'tex-1', type: 'shaderNode', data: { definition: NODE_REGISTRY.texture_2d, value: '' } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const edges = [
      { source: 'uv1', sourceHandle: 'out', target: 'tex-1', targetHandle: 'uv' },
      { source: 'tex-1', sourceHandle: 'rgb', target: 'out1', targetHandle: 'color' },
    ];
    const shader = compileGraphToGLSL(nodes, edges);
    expect(shader).toContain('texture2D(u_tex_tex_1, var_uv1)');
    expectValidGLSL(shader, 'texture with uv input');
  });

  it('collectRuntimeResources returns texture entries with their sources', () => {
    const { nodes } = textureGraph();
    const resources = collectRuntimeResources(nodes);
    expect(resources.textures).toEqual([
      { uniform: 'u_tex_tex_1', src: 'data:image/png;base64,abc' },
    ]);
    expect(resources.usesAudio).toBe(false);
  });
});

describe('Audio node (audio_input)', () => {
  const audioGraph = (): { nodes: GraphNode[]; edges: { source: string; sourceHandle: string; target: string; targetHandle: string }[] } => ({
    nodes: [
      { id: 'audio1', type: 'shaderNode', data: { definition: NODE_REGISTRY.audio_input } },
      { id: 'mono1', type: 'shaderNode', data: { definition: NODE_REGISTRY.mono } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ],
    edges: [
      { source: 'audio1', sourceHandle: 'y', target: 'mono1', targetHandle: 'in' }, // bass
      { source: 'mono1', sourceHandle: 'out', target: 'out1', targetHandle: 'color' },
    ],
  });

  it('declares all audio uniforms once', () => {
    const { nodes, edges } = audioGraph();
    const shader = compileGraphToGLSL(nodes, edges);
    Object.values(AUDIO_UNIFORMS).forEach(name => {
      expect(shader).toContain(`uniform float ${name};`);
    });
  });

  it('varType=vec4 makes swizzled outputs (x/y/z/w) compile correctly', () => {
    const { nodes, edges } = audioGraph();
    const shader = compileGraphToGLSL(nodes, edges);

    // Zmienna audio jest vec4 (varType), a bass czytany swizzlem .y
    expect(shader).toContain(`vec4 var_audio1 = vec4(${AUDIO_UNIFORMS.level}, ${AUDIO_UNIFORMS.bass}, ${AUDIO_UNIFORMS.mid}, ${AUDIO_UNIFORMS.high});`);
    expect(shader).toContain('vec3(var_audio1.y)');
    expectValidGLSL(shader, 'audio graph');
  });

  it('collectRuntimeResources flags audio usage', () => {
    const { nodes } = audioGraph();
    expect(collectRuntimeResources(nodes).usesAudio).toBe(true);
  });

  it('buildUniformDeclarations emits nothing for an empty graph', () => {
    expect(buildUniformDeclarations({ textures: [], usesAudio: false })).toBe('');
  });
});

describe('Media nodes registration', () => {
  it('texture_2d and audio_input are in registry with expected ports', () => {
    expect(NODE_REGISTRY.texture_2d.outputs[0]).toMatchObject({ id: 'rgb', type: 'vec3' });
    expect(NODE_REGISTRY.texture_2d.inputs[0]).toMatchObject({ id: 'uv', type: 'vec2' });
    expect(NODE_REGISTRY.audio_input.varType).toBe('vec4');
    expect(NODE_REGISTRY.audio_input.outputs.map(o => o.id)).toEqual(['x', 'y', 'z', 'w']);
  });
});
