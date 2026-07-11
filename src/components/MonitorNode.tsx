import { memo, useEffect, useState, useRef, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer, useEdges, useNodes } from 'reactflow';
import * as THREE from 'three';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { collectRuntimeResources } from '../core/runtimeResources';
import { buildResourceUniforms, updateAudioUniforms } from '../core/threeResources';
import { TYPE_COLORS } from '../core/theme';

// Grid the monitor probes to detect spatial variance (e.g. a texture or
// uv-dependent expression) — a single sample can't tell "constant value"
// apart from "varies wildly across the screen", so we sample a small grid
// and report min/max instead of just one point. Prime size on purpose:
// a round number (e.g. 24) aliases with common tiling scales (uv * 6, * 8,
// * 12...) and can sample the same phase every time, hiding real variance.
const SAMPLE_SIZE = 23;
const RANGE_EPSILON = 0.0015;

interface ChannelStat { min: number; max: number; avg: number; }

const computeChannelStats = (buf: Float32Array): ChannelStat[] => {
    const texelCount = buf.length / 4;
    return [0, 1, 2, 3].map(channel => {
        let min = Infinity, max = -Infinity, sum = 0;
        for (let i = channel; i < buf.length; i += 4) {
            const v = buf[i];
            if (v < min) min = v;
            if (v > max) max = v;
            sum += v;
        }
        return { min, max, avg: sum / texelCount };
    });
};

const Row = ({ label, stat, color }: { label: string, stat: ChannelStat, color: string }) => {
    const isRange = (stat.max - stat.min) > RANGE_EPSILON;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'bold', color: color, fontSize: '14px', marginRight: '10px' }}>{label}:</span>
                <span style={{ color: color, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>{stat.avg.toFixed(3)}</span>
            </div>
            {isRange && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>
                    <span>min {stat.min.toFixed(3)}</span>
                    <span>max {stat.max.toFixed(3)}</span>
                </div>
            )}
        </div>
    );
};

export const MonitorNode = memo(({ id, selected }: NodeProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [stats, setStats] = useState<ChannelStat[]>([
    { min: 0, max: 0, avg: 0 }, { min: 0, max: 0, avg: 0 }, { min: 0, max: 0, avg: 0 }, { min: 0, max: 0, avg: 0 },
  ]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE * 4));
  
  const requestRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const inputType = useMemo(() => {
      const connection = edges.find(e => e.target === id && e.targetHandle === 'in');
      if (!connection) return 'vec4';
      const sourceNode = nodes.find(n => n.id === connection.source);
      if (!sourceNode) return 'vec4';
      const definition = (sourceNode.data as { definition?: { id: string; inputs: { type: string }[]; outputs: { id: string; type: string }[] } })?.definition;
      if (!definition) return 'vec4';
      if (definition.id.includes('split')) {
          return definition.inputs[0].type;
      }
      return definition.outputs.find((o: { id: string; type: string }) => o.id === connection.sourceHandle)?.type || 'vec4';
  }, [edges, nodes, id]);

  useEffect(() => {
      isMountedRef.current = true;
      const width = SAMPLE_SIZE;
      const height = SAMPLE_SIZE;
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(width, height);

      const target = new THREE.WebGLRenderTarget(width, height, {
          type: THREE.FloatType, format: THREE.RGBAFormat,
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      });

      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({
          uniforms: { iTime: { value: 0 }, iResolution: { value: new THREE.Vector2(width, height) } },
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
                  uniforms: {
                      iTime: { value: 0 },
                      iResolution: { value: new THREE.Vector2(SAMPLE_SIZE, SAMPLE_SIZE) },
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

          if(rendererRef.current && sceneRef.current && meshRef.current && targetRef.current) {
              const mat = meshRef.current.material as THREE.ShaderMaterial;
              mat.uniforms.iTime.value = (now - startTime) * 0.001;
              updateAudioUniforms(mat);
              try {
                  rendererRef.current.setRenderTarget(targetRef.current);
                  rendererRef.current.render(sceneRef.current, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
                  rendererRef.current.readRenderTargetPixels(targetRef.current, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE, bufferRef.current);
                  rendererRef.current.setRenderTarget(null);
                  if (mounted) setStats(computeChannelStats(bufferRef.current));
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

  return (
    <>
      <NodeResizer minWidth={180} isVisible={selected} lineStyle={{ border: '1px solid #ff007a' }} />
      <div style={{ background: '#000', border: selected ? '1px solid #ff007a' : '1px solid #555', borderRadius: '8px', minWidth: '180px', height: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.6)', fontFamily: 'monospace', overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>MONITOR</span>
              <span style={{opacity: 0.7, color: TYPE_COLORS[inputType] || '#fff'}}>{inputType.toUpperCase()}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Row label="X" stat={stats[0]} color="#ff5252" />
              {inputType !== 'float' && (inputType === 'vec2' || inputType === 'vec3' || inputType === 'vec4') && <Row label="Y" stat={stats[1]} color="#69f0ae" />}
              {(inputType === 'vec3' || inputType === 'vec4') && <Row label="Z" stat={stats[2]} color="#448aff" />}
              {inputType === 'vec4' && <div style={{ borderTop: '1px solid #333', marginTop: '4px', paddingTop: '4px' }}><Row label="W" stat={stats[3]} color="#aaa" /></div>}
          </div>
          <Handle type="target" position={Position.Left} id="in" style={{ background: '#fff', width: '10px', height: '10px', border: '2px solid #000' }} />
          <Handle type="source" position={Position.Right} id="out" style={{ background: '#fff', width: '10px', height: '10px', border: '2px solid #000' }} />
      </div>
    </>
  );
});