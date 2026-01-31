import { memo, useEffect, useState, useRef, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer, useEdges, useNodes } from 'reactflow';
import * as THREE from 'three';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { TYPE_COLORS } from '../core/theme';

export const MonitorNode = memo(({ id, selected }: NodeProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [values, setValues] = useState<number[]>([0, 0, 0, 0]);
  
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(4)); 
  
  const requestRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const inputType = useMemo(() => {
      const connection = edges.find(e => e.target === id && e.targetHandle === 'in');
      if (!connection) return 'vec4';
      const sourceNode = nodes.find(n => n.id === connection.source);
      if (!sourceNode) return 'vec4';
      // Dla splita bierzemy typ wejścia jako źródło, dla reszty wyjście
      if (sourceNode.data.definition.id.includes('split')) {
          return sourceNode.data.definition.inputs[0].type;
      }
      return sourceNode.data.definition.outputs.find((o: any) => o.id === connection.sourceHandle)?.type || 'vec4';
  }, [edges, nodes, id]);

  useEffect(() => {
      isMountedRef.current = true;
      const width = 1;
      const height = 1;
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(width, height);
      
      const target = new THREE.WebGLRenderTarget(width, height, {
          type: THREE.FloatType, format: THREE.RGBAFormat,
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
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
          isMountedRef.current = false;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          renderer.dispose();
          target.dispose();
          rendererRef.current = null;
      };
  }, []);

  useEffect(() => {
      const updateShader = () => {
          if (!rendererRef.current || !meshRef.current || !isMountedRef.current) return;
          try {
              const currentNodes = getNodes();
              const currentEdges = getEdges();
              const safeNodes: GraphNode[] = currentNodes.map(node => ({
                id: node.id, type: node.type || 'shaderNode', data: node.data
              }));
              const code = compileGraphToGLSL(safeNodes, currentEdges, id);
              
              const oldMat = meshRef.current.material as THREE.ShaderMaterial;
              const newMat = new THREE.ShaderMaterial({
                  vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                  fragmentShader: code,
                  uniforms: { iTime: { value: 0 }, iResolution: { value: new THREE.Vector2(1, 1) } }
              });
              meshRef.current.material = newMat;
              oldMat.dispose();
          } catch (e) {}
      };
      const interval = setInterval(updateShader, 500); 
      updateShader();
      return () => clearInterval(interval);
  }, [getNodes, getEdges, id]);

  useEffect(() => {
      const startTime = Date.now();
      const loop = () => {
          if (!isMountedRef.current) return;
          requestRef.current = requestAnimationFrame(loop);
          
          const now = Date.now();
          if (now - lastUpdateRef.current < 100) return; // 10 FPS Limit
          lastUpdateRef.current = now;

          if(rendererRef.current && sceneRef.current && meshRef.current && targetRef.current) {
              const mat = meshRef.current.material as THREE.ShaderMaterial;
              mat.uniforms.iTime.value = (now - startTime) * 0.001;
              try {
                  rendererRef.current.setRenderTarget(targetRef.current);
                  rendererRef.current.render(sceneRef.current, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
                  rendererRef.current.readRenderTargetPixels(targetRef.current, 0, 0, 1, 1, bufferRef.current);
                  rendererRef.current.setRenderTarget(null);
                  if (isMountedRef.current) setValues([bufferRef.current[0], bufferRef.current[1], bufferRef.current[2], bufferRef.current[3]]);
              } catch (e) {}
          }
      };
      loop();
      return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  const Row = ({ label, value, color }: { label: string, value: number, color: string }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', color: color, fontSize: '14px', marginRight: '10px' }}>{label}:</span> 
          <span style={{ color: color, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>{value.toFixed(3)}</span>
      </div>
  );

  return (
    <>
      <NodeResizer minWidth={180} isVisible={selected} lineStyle={{ border: '1px solid #ff007a' }} />
      <div style={{ background: '#000', border: selected ? '1px solid #ff007a' : '1px solid #555', borderRadius: '8px', minWidth: '180px', height: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.6)', fontFamily: 'monospace', overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>MONITOR</span>
              <span style={{opacity: 0.7, color: TYPE_COLORS[inputType] || '#fff'}}>{inputType.toUpperCase()}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Row label="X" value={values[0]} color="#ff5252" />
              {inputType !== 'float' && (inputType === 'vec2' || inputType === 'vec3' || inputType === 'vec4') && <Row label="Y" value={values[1]} color="#69f0ae" />}
              {(inputType === 'vec3' || inputType === 'vec4') && <Row label="Z" value={values[2]} color="#448aff" />}
              {inputType === 'vec4' && <div style={{ borderTop: '1px solid #333', marginTop: '4px', paddingTop: '4px' }}><Row label="W" value={values[3]} color="#aaa" /></div>}
          </div>
          <Handle type="target" position={Position.Left} id="in" style={{ background: '#fff', width: '10px', height: '10px', border: '2px solid #000' }} />
          <Handle type="source" position={Position.Right} id="out" style={{ background: '#fff', width: '10px', height: '10px', border: '2px solid #000' }} />
      </div>
    </>
  );
});