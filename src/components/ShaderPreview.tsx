import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getShaderValidationReport } from '../core/validator';
import { shaderDebug } from '../core/shaderDebug';
import { buildShaderDebugText } from '../core/shaderDebugReport';
import type { ShaderRuntimeResources } from '../core/runtimeResources';
import { buildResourceUniforms, updateAudioUniforms, updateFeedbackUniform } from '../core/threeResources';
import { sharedFeedbackTexture } from '../core/feedbackBuffer';
import { getGlobalSettings, subscribeGlobalSettings, type GlobalSettings } from '../core/globalSettings';

const DEFAULT_FRAGMENT = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0,2,4));
    gl_FragColor = vec4(col, 1.0);
}
`;

const VERTEX_SHADER = `
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

interface Props {
  shaderCode?: string;
  /** Tekstury i audio wymagane przez shader (z collectRuntimeResources). */
  resources?: ShaderRuntimeResources;
  /**
   * True only for the single "real" main-screen preview (App.tsx). Only that
   * instance owns the feedback ping-pong buffers and drives a simulation
   * forward — every other consumer (Preview-tap nodes) reads the shared
   * previous-frame texture read-only, otherwise each Preview node dropped
   * anywhere in the graph would run its own independent, diverging sim.
   */
  isMainOutput?: boolean;
}

export default function ShaderPreview({ shaderCode, resources, isMainOutput = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugReport, setDebugReport] = useState<string | null>(null);
  const settingsRef = useRef<GlobalSettings>(getGlobalSettings());
  const resourcesRef = useRef<ShaderRuntimeResources | undefined>(resources);
  resourcesRef.current = resources;
  const usesFeedbackRef = useRef(false);
  // Ping-pong buffers — only ever allocated when isMainOutput && usesFeedback.
  const bufferARef = useRef<THREE.WebGLRenderTarget | null>(null);
  const bufferBRef = useRef<THREE.WebGLRenderTarget | null>(null);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh;
    animationId: number;
  } | null>(null);

  // 1. INIT (Standardowy)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || sceneRef.current) return;

    container.innerHTML = '';
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio * settingsRef.current.resolutionScale);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: DEFAULT_FRAGMENT,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(width, height) }
      }
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId = 0;
    sceneRef.current = { renderer, scene, camera, mesh, animationId };
    const startTime = Date.now();
    let lastFrameTime = 0;
    const animate = () => {
      if (!sceneRef.current) return;
      animationId = requestAnimationFrame(animate);
      sceneRef.current.animationId = animationId;

      // Globalny limit FPS (0 = bez limitu)
      const { fpsLimit } = settingsRef.current;
      const now = Date.now();
      if (fpsLimit > 0 && now - lastFrameTime < 1000 / fpsLimit) return;
      lastFrameTime = now;

      const time = (now - startTime) * 0.001;
      const { renderer: r, mesh } = sceneRef.current;
      const mat = mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms) mat.uniforms.iTime.value = time;
      updateAudioUniforms(mat);

      if (!isMainOutput) {
        // Debug tap (Preview node): read-only view of whatever the main
        // preview last rendered — never owns ping-pong state.
        updateFeedbackUniform(mat, sharedFeedbackTexture.current);
        r.render(scene, camera);
        return;
      }

      const usesFeedback = usesFeedbackRef.current;
      if (usesFeedback && (!bufferARef.current || !bufferBRef.current)) {
        // Sized off the actual drawing buffer (not container CSS size) so
        // 1 feedback texel lines up with 1 on-screen pixel/gl_FragCoord.
        const size = r.getDrawingBufferSize(new THREE.Vector2());
        const targetOptions = {
          type: THREE.FloatType, format: THREE.RGBAFormat,
          // NearestFilter is required, not cosmetic — LinearFilter would
          // blur neighbor samples into fractional values and break any
          // simulation relying on crisp per-cell state (e.g. Game of Life).
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        };
        bufferARef.current = new THREE.WebGLRenderTarget(size.x, size.y, targetOptions);
        bufferBRef.current = new THREE.WebGLRenderTarget(size.x, size.y, targetOptions);
      } else if (!usesFeedback && bufferARef.current) {
        bufferARef.current.dispose();
        bufferBRef.current?.dispose();
        bufferARef.current = null;
        bufferBRef.current = null;
        sharedFeedbackTexture.current = null;
      }

      if (usesFeedback && bufferARef.current && bufferBRef.current) {
        const readBuffer = bufferARef.current;
        const writeBuffer = bufferBRef.current;
        updateFeedbackUniform(mat, readBuffer.texture);
        r.setRenderTarget(writeBuffer);
        r.render(scene, camera);
        r.setRenderTarget(null);
        r.render(scene, camera); // same material/uniforms → identical screen image
        sharedFeedbackTexture.current = writeBuffer.texture;
        bufferARef.current = writeBuffer;
        bufferBRef.current = readBuffer;
      } else {
        r.render(scene, camera);
      }
    };
    animate();

    const applySize = () => {
        if(container && sceneRef.current) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            const scale = window.devicePixelRatio * settingsRef.current.resolutionScale;

            sceneRef.current.renderer.setPixelRatio(scale);
            sceneRef.current.renderer.setSize(w, h);

            const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.iResolution.value.set(w * scale, h * scale);
            }

            // Ping-pong buffers are sized to the drawing buffer — simplest
            // correct behavior on resize is to drop them and let animate()
            // lazily recreate at the new size next frame. This resets any
            // running simulation, which is the intended behavior here.
            if (bufferARef.current || bufferBRef.current) {
                bufferARef.current?.dispose();
                bufferBRef.current?.dispose();
                bufferARef.current = null;
                bufferBRef.current = null;
            }
        }
    };

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    // Reaguj na zmianę globalnych ustawień (limit FPS czyta pętla, skalę stosujemy tu)
    const unsubscribeSettings = subscribeGlobalSettings((settings) => {
        settingsRef.current = settings;
        applySize();
    });

    return () => {
      unsubscribeSettings();
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      bufferARef.current?.dispose();
      bufferBRef.current?.dispose();
      bufferARef.current = null;
      bufferBRef.current = null;
      // Avoid a stale texture from a torn-down GL context leaking into
      // Monitor/Color Preview after the main preview unmounts.
      if (isMainOutput) sharedFeedbackTexture.current = null;
      renderer.dispose();
      if (container) container.innerHTML = '';
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !shaderCode) return;

    const updateShader = () => {
        const validation = getShaderValidationReport(shaderCode);
        const debugText = buildShaderDebugText(validation);

        if (!validation.valid) {
            const errorSummary = validation.errors
              .map(issue => issue.line ? `L${issue.line}: ${issue.message}` : issue.message)
              .join(' | ');
            shaderDebug.warn('preview', 'Blocked shader update because validation failed', {
              validation,
              debugReport: debugText,
            });
            setErrorMessage(errorSummary || validation.error || 'Unknown compilation error');
            setDebugReport(debugText);
            return;
        }

        if (validation.warnings.length > 0 || validation.glslang?.available) {
            shaderDebug.log('preview', 'Shader validation diagnostics', {
              validation,
              debugReport: debugText,
            });
            setDebugReport(debugText);
        } else {
            setDebugReport(null);
        }

        setErrorMessage(null);
        try {
            const oldMat = sceneRef.current!.mesh.material as THREE.ShaderMaterial;
            const newMat = new THREE.ShaderMaterial({
                vertexShader: VERTEX_SHADER,
                fragmentShader: shaderCode,
                uniforms: {
                    iTime: { value: oldMat.uniforms?.iTime?.value || 0 },
                    iResolution: { value: oldMat.uniforms?.iResolution?.value || new THREE.Vector2(1,1) },
                    ...(resourcesRef.current ? buildResourceUniforms(resourcesRef.current) : {})
                }
            });

            sceneRef.current!.mesh.material = newMat;
            oldMat.dispose();
            usesFeedbackRef.current = resourcesRef.current?.usesFeedback ?? false;
            shaderDebug.log('preview', 'Shader updated successfully');
        } catch (e) {
            const runtimeMessage = e instanceof Error ? e.message : 'Unknown Three.js shader error';
            const runtimeDebug = [`Runtime shader update failed`, `message: ${runtimeMessage}`].join('\n');
            shaderDebug.error('preview', 'Three.js shader update failed', {
              error: e,
              debugReport: runtimeDebug,
            });
            setErrorMessage(runtimeMessage);
            setDebugReport(runtimeDebug);
        }
    };

    updateShader();
  }, [shaderCode]);

  // Wgranie/zmiana obrazka nie zmienia kodu shadera (nazwa uniformu stała) —
  // aktualizujemy wartości uniformów na istniejącym materiale.
  useEffect(() => {
    if (!sceneRef.current || !resources) return;
    const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
    if (!mat.uniforms) return;
    const resUniforms = buildResourceUniforms(resources);
    Object.entries(resUniforms).forEach(([name, uniform]) => {
      if (mat.uniforms[name]) {
        mat.uniforms[name].value = uniform.value;
      } else {
        mat.uniforms[name] = uniform;
      }
    });
  }, [resources]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {(errorMessage || debugReport) && (
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: errorMessage ? 'rgba(200, 0, 0, 0.9)' : 'rgba(20, 20, 20, 0.9)', color: 'white',
                padding: '10px', fontSize: '12px', fontFamily: 'monospace',
                borderTop: errorMessage ? '2px solid red' : '2px solid #666', maxHeight: '180px', overflow: 'auto',
                whiteSpace: 'pre-wrap'
            }}>
                <strong>{errorMessage ? 'COMPILATION ERROR' : 'SHADER DEBUG REPORT'}</strong><br/>
                {errorMessage && <div>{errorMessage}</div>}
                {debugReport && (
                    <details open={Boolean(errorMessage)} style={{ marginTop: '8px' }}>
                        <summary>Validation details</summary>
                        <div style={{ marginTop: '8px' }}>{debugReport}</div>
                    </details>
                )}
            </div>
        )}
    </div>
  );
}
