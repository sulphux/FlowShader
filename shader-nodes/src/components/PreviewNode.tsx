import { memo, useEffect, useState, useRef } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import ShaderPreview from './ShaderPreview';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';

export const PreviewNode = memo(({ id, selected }: NodeProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const [shaderCode, setShaderCode] = useState<string>('');
  
  const updatePreview = () => {
      const nodes = getNodes();
      const edges = getEdges();
      
      const safeNodes: GraphNode[] = nodes.map(node => ({
        id: node.id,
        type: node.type || 'shaderNode', // Czysty kod bez śmieci
        data: node.data
      }));

      // Kompilujemy graf celując w ten konkretny node (id)
      const code = compileGraphToGLSL(safeNodes, edges, id);
      setShaderCode(code);
  };

  useEffect(() => {
      // Odświeżanie co 500ms, żeby nie zajechać przeglądarki
      const interval = setInterval(updatePreview, 500);
      updatePreview(); 
      return () => clearInterval(interval);
  }, [getNodes, getEdges, id]);

  const baseStyle: React.CSSProperties = {
    background: '#000',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    borderRadius: '8px',
    width: '100%', 
    height: '100%', 
    minWidth: '150px',
    minHeight: '150px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative', // Ważne dla absolute children
    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
  };

  return (
    <>
        <NodeResizer 
            minWidth={150} 
            minHeight={150} 
            isVisible={selected} 
            lineStyle={{ border: '1px solid #ff007a' }} 
            handleStyle={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff007a' }}
        />
        <div style={baseStyle}>
            {/* Header */}
            <div style={{ 
                height: '24px', background: '#222', borderBottom: '1px solid #333',
                display: 'flex', alignItems: 'center', padding: '0 8px',
                color: '#aaa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px',
                zIndex: 2 // Header nad canvasem
            }}>
                PREVIEW
            </div>
            
            {/* FIX: Layout Loop Breaker */}
            {/* Ustawiamy kontener Canvasa absolutnie, żeby nie "rozpychał" rodzica */}
            <div style={{ 
                position: 'absolute', 
                top: '24px', // Zaraz pod headerem
                left: 0, 
                right: 0, 
                bottom: 0, 
                pointerEvents: 'none', // Kliknięcia przelatują do noda (selekcja)
                zIndex: 1
            }}>
                <ShaderPreview shaderCode={shaderCode} />
            </div>

            <Handle 
                type="target" 
                position={Position.Left} 
                id="in" 
                style={{ 
                    background: '#fff', width: '12px', height: '12px', 
                    left: '-6px', top: '50%', transform: 'translate(0, -50%)',
                    border: '2px solid #000',
                    zIndex: 3 // Handle na wierzchu
                }} 
            />
        </div>
    </>
  );
});