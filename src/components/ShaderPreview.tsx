import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { validateGLSL } from '../core/validator';

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
}

export default function ShaderPreview({ shaderCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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
    renderer.setPixelRatio(window.devicePixelRatio);
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
    const animate = () => {
      if (!sceneRef.current) return;
      const time = (Date.now() - startTime) * 0.001;
      const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms) mat.uniforms.iTime.value = time;
      sceneRef.current.renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
      sceneRef.current.animationId = animationId;
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
        if(container && sceneRef.current) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            
            sceneRef.current.renderer.setSize(w, h);
            
            const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                const dpr = window.devicePixelRatio;
                mat.uniforms.iResolution.value.set(w * dpr, h * dpr);
            }
        }
    }); 
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (container) container.innerHTML = '';
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !shaderCode) return;

    const updateShader = () => {
        const validation = validateGLSL(shaderCode);

        if (!validation.valid) {
            console.warn("🛑 [Validator] Blokada:", validation.error);
            setErrorMessage(validation.error || "Unknown Error");
            return; 
        }

        setErrorMessage(null);
        try {
            const oldMat = sceneRef.current!.mesh.material as THREE.ShaderMaterial;
            const newMat = new THREE.ShaderMaterial({
                vertexShader: VERTEX_SHADER,
                fragmentShader: shaderCode,
                uniforms: {
                    iTime: { value: oldMat.uniforms?.iTime?.value || 0 },
                    iResolution: { value: oldMat.uniforms?.iResolution?.value || new THREE.Vector2(1,1) }
                }
            });

            sceneRef.current!.mesh.material = newMat;
            oldMat.dispose();
            console.log("✅ [Preview] Shader zaktualizowany.");
        } catch (e) {
            console.error("🔥 [Preview] Błąd Three.js:", e);
        }
    };

    updateShader();
  }, [shaderCode]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* WARSTWA BŁĘDU */}
        {errorMessage && (
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(200, 0, 0, 0.9)', color: 'white',
                padding: '10px', fontSize: '12px', fontFamily: 'monospace',
                borderTop: '2px solid red', maxHeight: '150px', overflow: 'auto'
            }}>
                <strong>⚠️ COMPILATION ERROR:</strong><br/>
                {errorMessage}
            </div>
        )}
    </div>
  );
}