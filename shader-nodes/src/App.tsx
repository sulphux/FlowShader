import { useState, useCallback, useRef, useEffect } from 'react';
import NodeEditor from './components/NodeEditor';
import ShaderPreview from './components/ShaderPreview';
import { compileGraphToGLSL, type GraphNode } from './core/compiler';
import type { Node, Edge } from 'reactflow';

function App() {
  const [shaderCode, setShaderCode] = useState<string | undefined>(undefined);
  
  // --- LAYOUT STATE ---
  const [splitPercent, setSplitPercent] = useState(60); // Startowo 60% dla edytora
  const [isResizing, setIsResizing] = useState(false);
  const [isFloating, setIsFloating] = useState(false); // Tryb PiP

  const containerRef = useRef<HTMLDivElement>(null);

  const handleGraphChange = useCallback((nodes: Node[], edges: Edge[]) => {
    // FIX: Konwersja typów Node[] -> GraphNode[]
    const safeNodes: GraphNode[] = nodes.map(node => ({
      id: node.id,
      type: node.type || 'shaderNode',
      data: node.data
    }));

    const glsl = compileGraphToGLSL(safeNodes, edges);
    setShaderCode(glsl);
  }, []);

  // --- LOGIKA ZMIANY ROZMIARU (RESIZE) ---
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const newPercent = (e.clientX / containerWidth) * 100;
      
      // Ograniczenia (min 20%, max 80%)
      if (newPercent > 20 && newPercent < 80) {
        setSplitPercent(newPercent);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        width: '100vw', 
        height: '100vh', 
        background: '#000', 
        overflow: 'hidden',
        position: 'relative' // Dla pozycjonowania absolute
      }}
    >
      {/* 1. EDYTOR NODÓW */}
      <div style={{ 
        width: isFloating ? '100%' : `${splitPercent}%`, // 100% gdy PiP, inaczej % suwaka
        height: '100%', 
        position: 'relative',
        transition: isResizing ? 'none' : 'width 0.3s ease' // Animacja przy przełączaniu trybów
      }}>
        <NodeEditor onChange={handleGraphChange} />
      </div>

      {/* 2. SUWAK (Widoczny tylko gdy NIE ma trybu pływającego) */}
      {!isFloating && (
        <div 
          className="resizer"
          onMouseDown={startResizing}
        />
      )}

      {/* 3. PODGLĄD SHADERA (Preview / PiP) */}
      <div style={
        isFloating ? {
          // --- STYL DLA OKIENKA PŁYWAJĄCEGO (PiP) ---
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '320px',
          height: '240px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          border: '1px solid #444',
          zIndex: 2000,
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
        } : {
          // --- STYL DLA PANELU BOCZNEGO ---
          width: `${100 - splitPercent}%`,
          height: '100%',
          position: 'relative',
          transition: isResizing ? 'none' : 'width 0.3s ease'
        }
      }>
        
        {/* Przycisk Toggle PiP */}
        <button
          onClick={() => setIsFloating(!isFloating)}
          title={isFloating ? "Dock to Right" : "Float Window (PiP)"}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px'
          }}
        >
          {isFloating ? '⇲' : '❐'}
        </button>

        <ShaderPreview shaderCode={shaderCode} />
      </div>
    </div>
  );
}

export default App;