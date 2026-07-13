import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FeedbackPassRenderer } from './feedbackPassRenderer';
import type { FrameBufferMode } from './frameBufferMode';
import type { ShaderRuntimeResources } from './runtimeResources';

const UNIFORM = 'u_feedback_buffer1';

function renderFrames(mode: FrameBufferMode, frameCount = 1) {
  let currentTarget: THREE.WebGLRenderTarget | null = null;
  const targetCalls: THREE.WebGLRenderTarget[] = [];
  const renderer = {
    getRenderTarget: () => currentTarget,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => {
      currentTarget = target;
      if (target) targetCalls.push(target);
    },
    clear: () => undefined,
    render: () => undefined,
  } as unknown as THREE.WebGLRenderer;

  const resources: ShaderRuntimeResources = {
    textures: [], usesAudio: false, usesFeedback: true,
    feedbacks: [{ nodeId: 'buffer1', uniform: UNIFORM }],
  };
  const passRenderer = new FeedbackPassRenderer();
  passRenderer.setSize(4, 4);
  passRenderer.configure([{
    nodeId: 'buffer1', uniform: UNIFORM, shader: 'void main() { gl_FragColor = vec4(0.0); }', captureMode: mode,
  }], resources);

  const displayMaterial = new THREE.ShaderMaterial({ uniforms: { [UNIFORM]: { value: null } } });
  const mesh = { material: displayMaterial } as unknown as THREE.Mesh;
  const boundTextures: unknown[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    passRenderer.renderPasses(
      renderer,
      {} as THREE.Scene,
      {} as THREE.Camera,
      mesh,
      frame,
    );
    passRenderer.bindCurrent(displayMaterial);
    boundTextures.push(displayMaterial.uniforms[UNIFORM].value);
  }

  passRenderer.dispose();
  displayMaterial.dispose();
  return { targetCalls, boundTextures };
}

describe('FeedbackPassRenderer display generation', () => {
  it('shows a newly captured Snapshot immediately', () => {
    const { targetCalls, boundTextures } = renderFrames('snapshot');
    const initialRead = targetCalls[0];
    const justWritten = targetCalls[1];

    expect(justWritten).not.toBe(initialRead);
    expect(boundTextures[0]).toBe(justWritten.texture);
  });

  it('keeps Last Frame exactly one completed generation behind across swaps', () => {
    const { targetCalls, boundTextures } = renderFrames('last-frame', 2);
    const previousFrame = targetCalls[0];
    const firstWrite = targetCalls[1];
    const secondWrite = targetCalls[3];

    expect(firstWrite).not.toBe(previousFrame);
    expect(secondWrite).toBe(previousFrame);
    expect(boundTextures[0]).toBe(previousFrame.texture);
    expect(boundTextures[0]).not.toBe(firstWrite.texture);
    expect(boundTextures[1]).toBe(firstWrite.texture);
    expect(boundTextures[1]).not.toBe(secondWrite.texture);
  });
});
