import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getShaderValidationReport } from '../core/validator';
import { shaderDebug } from '../core/shaderDebug';
import { buildShaderDebugText } from '../core/shaderDebugReport';
import type { ShaderRuntimeResources } from '../core/runtimeResources';
import { buildResourceUniforms, updateAudioUniforms } from '../core/threeResources';
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
}

export default function ShaderPreview({ shaderCode, resources }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugReport, setDebugReport] = useState<string | null>(null);
  const settingsRef = useRef<GlobalSettings>(getGlobalSettings());
  const resourcesRef = useRef<ShaderRuntimeResources | undefined>(resources);
  resourcesRef.current = resources;

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
      const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms) mat.uniforms.iTime.value = time;
      updateAudioUniforms(mat);
      sceneRef.current.renderer.render(scene, camera);
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
