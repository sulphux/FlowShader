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
    if (!containerRef.current || sceneRef.current) return;

    containerRef.current.innerHTML = '';
    let width = Math.max(containerRef.current.clientWidth, 1);
    let height = Math.max(containerRef.current.clientHeight, 1);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

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

    sceneRef.current = { renderer, scene, camera, mesh, animationId: 0 };
    const startTime = Date.now();
    const animate = () => {
      if (!sceneRef.current) return;
      const time = (Date.now() - startTime) * 0.001;
      const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms) mat.uniforms.iTime.value = time;
      sceneRef.current.renderer.render(scene, camera);
      sceneRef.current.animationId = requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
        if(containerRef.current && sceneRef.current) {
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            
            // 1. Aktualizujemy Renderera (to było dobrze)
            sceneRef.current.renderer.setSize(w, h);
            
            // 2. Aktualizujemy Shader (TU BYŁ BŁĄD)
            const mat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                // Musimy uwzględnić zagęszczenie pikseli (pixel ratio)
                const dpr = window.devicePixelRatio;
                mat.uniforms.iResolution.value.set(w * dpr, h * dpr);
            }
        }
    }); 
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.renderer.dispose();
        if (containerRef.current) containerRef.current.innerHTML = '';
        sceneRef.current = null;
      }
    };
  }, []);

  // 2. UPDATE Z WALIDATOREM
  useEffect(() => {
    if (!sceneRef.current || !shaderCode) return;

    // --- KROK 1: Sprawdź poprawność ---
    const validation = validateGLSL(shaderCode);

    if (!validation.valid) {
        // Jeśli błąd -> Logujemy i wyświetlamy, ale NIE aktualizujemy sceny.
        console.warn("🛑 [Validator] Blokada:", validation.error);
        setErrorMessage(validation.error || "Unknown Error");
        return; 
    }

    // --- KROK 2: Jeśli OK -> Aktualizuj ---
    setErrorMessage(null); // Czyścimy błędy
    try {
        const oldMat = sceneRef.current.mesh.material as THREE.ShaderMaterial;
        const newMat = new THREE.ShaderMaterial({
            vertexShader: VERTEX_SHADER,
            fragmentShader: shaderCode,
            uniforms: {
                iTime: { value: oldMat.uniforms?.iTime?.value || 0 },
                iResolution: { value: oldMat.uniforms?.iResolution?.value || new THREE.Vector2(1,1) }
            }
        });

        sceneRef.current.mesh.material = newMat;
        oldMat.dispose();
        console.log("✅ [Preview] Shader zaktualizowany.");
    } catch (e) {
        console.error("🔥 [Preview] Błąd Three.js:", e);
    }
    
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