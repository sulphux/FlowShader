import { memo, useEffect, useState, useRef } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import ShaderPreview from './ShaderPreview';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';

export const PreviewNode = memo(({ id, selected }: NodeProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const [shaderCode, setShaderCode] = useState<string>('');
  
  // Funkcja odświeżająca podgląd
  const updatePreview = () => {
      const nodes = getNodes();
      const edges = getEdges();
      
      const safeNodes: GraphNode[] = nodes.map(node => ({
        id: node.id,
        type: node.type || 'shaderNode',
        data: node.data
      }));

      // Kompilujemy graf z celem na TEN node
      const code = compileGraphToGLSL(safeNodes, edges, id);
      setShaderCode(code);
  };

  // Odświeżanie co 500ms (żeby nie zajechać GPU przy przesuwaniu)
  useEffect(() => {
      const interval = setInterval(updatePreview, 500);
      updatePreview(); // First run
      return () => clearInterval(interval);
  }, [getNodes, getEdges, id]);

  const baseStyle: React.CSSProperties = {
    background: '#000',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    borderRadius: '8px',
    // FIX: Musimy wymusić wypełnienie rodzica, bo NodeResizer powiększa wrapper ReactFlow, a nie ten div bezpośrednio
    width: '100%', 
    height: '100%', 
    minWidth: '150px',
    minHeight: '150px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
  };

  return (
    <>
        <NodeResizer minWidth={150} minHeight={150} isVisible={selected} lineStyle={{ border: '1px solid #ff007a' }} />
        <div style={baseStyle}>
            {/* Header */}
            <div style={{ 
                height: '24px', background: '#222', borderBottom: '1px solid #333',
                display: 'flex', alignItems: 'center', padding: '0 8px',
                color: '#aaa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px'
            }}>
                PREVIEW
            </div>
            
            {/* Ekran */}
            <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden' }}>
                {/* Ważne: pointerEvents: none, żebyś mógł klikać noda (zaznaczać go) klikając w ekran */}
                <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <ShaderPreview shaderCode={shaderCode} />
                </div>
            </div>

            {/* Input */}
            <Handle 
                type="target" 
                position={Position.Left} 
                id="in" 
                style={{ 
                    background: '#fff', width: '12px', height: '12px', 
                    left: '-6px', top: '50%', transform: 'translate(0, -50%)',
                    border: '2px solid #000'
                }} 
            />
        </div>
    </>
  );
});