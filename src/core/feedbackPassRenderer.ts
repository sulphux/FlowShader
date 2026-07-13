import * as THREE from 'three';
import type { FeedbackPassDefinition } from './feedbackPasses';
import type { ShaderRuntimeResources } from './runtimeResources';
import { buildResourceUniforms, updateAudioUniforms, updateFeedbackUniforms } from './threeResources';

const VERTEX_SHADER = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

interface PassState {
  definition: FeedbackPassDefinition;
  material: THREE.ShaderMaterial;
  read: THREE.WebGLRenderTarget | null;
  write: THREE.WebGLRenderTarget | null;
}

/** Owns the independent ping-pong buffer and writer material for each Feedback node. */
export class FeedbackPassRenderer {
  private states: PassState[] = [];
  private width = 0;
  private height = 0;

  configure(passes: FeedbackPassDefinition[], resources?: ShaderRuntimeResources): void {
    this.disposeStates();
    this.states = passes.map(definition => ({
      definition,
      material: new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: definition.shader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector2(Math.max(this.width, 1), Math.max(this.height, 1)) },
          ...(resources ? buildResourceUniforms(resources) : {}),
        },
      }),
      read: null,
      write: null,
    }));
  }

  updateResources(resources?: ShaderRuntimeResources): void {
    if (!resources) return;
    this.states.forEach(state => {
      const uniforms = buildResourceUniforms(resources);
      Object.entries(uniforms).forEach(([name, uniform]) => {
        if (state.material.uniforms[name]) state.material.uniforms[name].value = uniform.value;
        else state.material.uniforms[name] = uniform;
      });
    });
  }

  setSize(width: number, height: number): void {
    const nextWidth = Math.max(Math.round(width), 1);
    const nextHeight = Math.max(Math.round(height), 1);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.states.forEach(state => {
      state.material.uniforms.iResolution?.value.set(nextWidth, nextHeight);
      state.read?.dispose();
      state.write?.dispose();
      state.read = null;
      state.write = null;
    });
  }

  private ensureTargets(renderer: THREE.WebGLRenderer, state: PassState): void {
    if (state.read && state.write) return;
    const options: THREE.RenderTargetOptions = {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    state.read = new THREE.WebGLRenderTarget(Math.max(this.width, 1), Math.max(this.height, 1), options);
    state.write = new THREE.WebGLRenderTarget(Math.max(this.width, 1), Math.max(this.height, 1), options);

    // A retained snapshot must start from deterministic black, not undefined
    // GPU memory (important when Impulse is initially zero).
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(state.read);
    renderer.clear();
    renderer.setRenderTarget(state.write);
    renderer.clear();
    renderer.setRenderTarget(previousTarget);
  }

  private currentTextures(): Map<string, THREE.Texture> {
    const textures = new Map<string, THREE.Texture>();
    this.states.forEach(state => {
      if (state.read) textures.set(state.definition.uniform, state.read.texture);
    });
    return textures;
  }

  /**
   * Snapshot should become visible as soon as it is captured. Last Frame is
   * different: after the ping-pong swap `read` is the just-written current
   * input and `write` is the completed previous frame, which is the texture
   * consumers must see for a real one-frame delay.
   */
  private displayTextures(): Map<string, THREE.Texture> {
    const textures = new Map<string, THREE.Texture>();
    this.states.forEach(state => {
      const target = state.definition.captureMode === 'last-frame' ? state.write : state.read;
      if (target) textures.set(state.definition.uniform, target.texture);
    });
    return textures;
  }

  renderPasses(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    mesh: THREE.Mesh,
    time: number
  ): void {
    if (this.states.length === 0) return;
    this.states.forEach(state => this.ensureTargets(renderer, state));

    // All writers sample the same previous generation. Buffers are swapped
    // only after every pass has rendered, so multiple Feedback nodes update
    // synchronously instead of leaking order-dependent current-frame values.
    const previousTextures = this.currentTextures();
    const originalMaterial = mesh.material;
    const originalTarget = renderer.getRenderTarget();
    this.states.forEach(state => {
      state.material.uniforms.iTime.value = time;
      updateAudioUniforms(state.material);
      updateFeedbackUniforms(state.material, previousTextures);
      mesh.material = state.material;
      renderer.setRenderTarget(state.write);
      renderer.render(scene, camera);
    });
    mesh.material = originalMaterial;
    renderer.setRenderTarget(originalTarget);

    this.states.forEach(state => {
      const previousRead = state.read;
      state.read = state.write;
      state.write = previousRead;
    });
  }

  bindCurrent(material: THREE.ShaderMaterial): void {
    updateFeedbackUniforms(material, this.displayTextures());
  }

  dispose(): void {
    this.disposeStates();
  }

  private disposeStates(): void {
    this.states.forEach(state => {
      state.material.dispose();
      state.read?.dispose();
      state.write?.dispose();
    });
    this.states = [];
  }
}
