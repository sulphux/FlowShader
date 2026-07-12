import { memo, useEffect, useState, useRef } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow';
import * as THREE from 'three';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { collectRuntimeResources } from '../core/runtimeResources';
import { buildResourceUniforms, updateAudioUniforms, updateFeedbackUniform } from '../core/threeResources';
import { sharedFeedbackTexture } from '../core/feedbackBuffer';

/**
 * Color Preview — pokazuje próbkę koloru sygnału wejściowego.
 * Działa jak Value Watcher (render 1x1 px do render targetu i odczyt piksela),
 * ale zamiast liczb pokazuje kolor.
 */
export const ColorPreviewNode = memo(({ id, selected }: NodeProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const [rgba, setRgba] = useState<[number, number, number, number]>([0, 0, 0, 1]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(4));
  const requestRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(1, 1);

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: { iTime: { value: 0 }, iResolution: { value: new THREE.Vector2(1, 1) } },
      fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }'
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    rendererRef.current = renderer;
    targetRef.current = target;
    sceneRef.current = scene;
    meshRef.current = mesh;

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      renderer.dispose();
      target.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const updateShader = () => {
      if (!rendererRef.current || !meshRef.current) return;
      try {
        const safeNodes: GraphNode[] = getNodes().map(node => ({
          id: node.id, type: node.type || 'shaderNode', data: node.data
        }));
        const code = compileGraphToGLSL(safeNodes, getEdges(), id);

        const oldMat = meshRef.current.material as THREE.ShaderMaterial;
        const newMat = new THREE.ShaderMaterial({
          vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: code,
          uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(1, 1) },
            ...buildResourceUniforms(collectRuntimeResources(safeNodes))
          }
        });
        meshRef.current.material = newMat;
        oldMat.dispose();
      } catch {
        // Silent error handling
      }
    };
    const interval = setInterval(updateShader, 500);
    updateShader();
    return () => clearInterval(interval);
  }, [getNodes, getEdges, id]);

  useEffect(() => {
    let mounted = true;
    const startTime = Date.now();
    const loop = () => {
      if (!mounted) return;
      requestRef.current = requestAnimationFrame(loop);

      const now = Date.now();
      if (now - lastUpdateRef.current < 100) return;
      lastUpdateRef.current = now;

      if (rendererRef.current && sceneRef.current && meshRef.current && targetRef.current) {
        const mat = meshRef.current.material as THREE.ShaderMaterial;
        mat.uniforms.iTime.value = (now - startTime) * 0.001;
        updateAudioUniforms(mat);
        updateFeedbackUniform(mat, sharedFeedbackTexture.current);
        try {
          rendererRef.current.setRenderTarget(targetRef.current);
          rendererRef.current.render(sceneRef.current, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
          rendererRef.current.readRenderTargetPixels(targetRef.current, 0, 0, 1, 1, bufferRef.current);
          rendererRef.current.setRenderTarget(null);
          if (mounted) {
            const [r, g, b, a] = bufferRef.current;
            setRgba([r, g, b, a]);
          }
        } catch {
          // Silent error handling
        }
      }
    };
    loop();
    return () => {
      mounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const to255 = (v: number) => Math.round(clamp01(v) * 255);
  const [r, g, b] = rgba;
  const cssColor = `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`;
  const hex = `#${[r, g, b].map(v => to255(v).toString(16).padStart(2, '0')).join('')}`;

  return (
    <div style={{
      background: '#000',
      border: selected ? '1px solid #ff007a' : '1px solid #555',
      borderRadius: '8px', overflow: 'hidden', fontFamily: 'monospace',
      boxShadow: '0 4px 15px rgba(0,0,0,0.6)', width: '110px'
    }}>
      <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold', color: '#aaa' }}>
        COLOR
      </div>
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        <div style={{
          width: '90px', height: '48px', borderRadius: '6px',
          background: cssColor, border: '1px solid #333',
          boxShadow: `0 0 12px ${cssColor}55`
        }} />
        <span style={{ fontSize: '10px', color: '#ccc', userSelect: 'text' }}>{hex}</span>
      </div>
      <Handle type="target" position={Position.Left} id="in" style={{ background: '#fff', width: '10px', height: '10px', border: '2px solid #000' }} />
    </div>
  );
});
