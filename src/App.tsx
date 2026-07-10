import { useState, useCallback, useRef, useEffect } from 'react';
import NodeEditor from './components/NodeEditor';
import ShaderPreview from './components/ShaderPreview';
import { compileGraphToGLSL, type GraphNode } from './core/compiler';
import { collectRuntimeResources, type ShaderRuntimeResources } from './core/runtimeResources';
import type { Node, Edge } from 'reactflow';

function App() {
  const [shaderCode, setShaderCode] = useState<string | undefined>(undefined);
  const [shaderResources, setShaderResources] = useState<ShaderRuntimeResources | undefined>(undefined);
  
  // --- LAYOUT STATE ---
  const [splitPercent, setSplitPercent] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [isPreviewHidden, setIsPreviewHidden] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleGraphChange = useCallback((nodes: Node[], edges: Edge[]) => {
    const safeNodes: GraphNode[] = nodes.map(node => ({
      id: node.id,
      type: node.type || 'shaderNode',
      data: node.data
    }));

    const glsl = compileGraphToGLSL(safeNodes, edges);
    setShaderCode(glsl);
    setShaderResources(collectRuntimeResources(safeNodes));
  }, []);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const newPercent = (e.clientX / containerWidth) * 100;
      if (newPercent > 20 && newPercent < 80) setSplitPercent(newPercent);
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
        display: 'flex', width: '100vw', height: '100vh', 
        background: '#000', overflow: 'hidden', position: 'relative'
      }}
    >
      {/* 0. SIDEBAR ROOT (Tu wstrzykniemy Sidebar z NodeEditora) */}
      <div id="sidebar-root" style={{ height: '100%', zIndex: 50 }}>
          {/* Pusto - NodeEditor wypełni to przez Portal */}
      </div>

      {/* 1. EDYTOR NODÓW */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        height: '100%', 
        position: 'relative'
      }}>
          {/* Obszar Edytora */}
          <div style={{
            width: (isFloating || isPreviewHidden) ? '100%' : `${splitPercent}%`,
            height: '100%',
            position: 'relative',
            transition: isResizing ? 'none' : 'width 0.3s ease'
          }}>
            <NodeEditor onChange={handleGraphChange} />
          </div>

          {/* Przywracanie schowanego podglądu */}
          {isPreviewHidden && (
            <button
              onClick={() => setIsPreviewHidden(false)}
              title="Show Preview"
              style={{
                position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                zIndex: 2000, background: '#1a1a1a', color: '#fff',
                border: '1px solid #444', borderRight: 'none',
                borderRadius: '8px 0 0 8px', width: '22px', height: '64px',
                cursor: 'pointer', fontSize: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              ◀
            </button>
          )}

          {/* 2. SUWAK */}
          {!isFloating && !isPreviewHidden && (
            <div className="resizer" onMouseDown={startResizing} />
          )}

          {/* 3. PODGLĄD SHADERA */}
          {!isPreviewHidden && (
          <div style={
            isFloating ? {
              position: 'absolute', bottom: '20px', right: '20px',
              width: '320px', height: '240px', borderRadius: '12px',
              overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              border: '1px solid #444', zIndex: 2000,
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
            } : {
              width: `${100 - splitPercent}%`,
              height: '100%',
              position: 'relative',
              transition: isResizing ? 'none' : 'width 0.3s ease'
            }
          }>
            <button
              onClick={() => setIsFloating(!isFloating)}
              title={isFloating ? "Dock to Right" : "Float Window (PiP)"}
              style={{
                position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
              }}
            >
              {isFloating ? '⇲' : '❐'}
            </button>

            <button
              onClick={() => { setIsPreviewHidden(true); setIsFloating(false); }}
              title="Hide Preview"
              style={{
                position: 'absolute', top: '10px', right: '40px', zIndex: 10,
                background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
              }}
            >
              ✕
            </button>

            <ShaderPreview shaderCode={shaderCode} resources={shaderResources} />
          </div>
          )}
      </div>
    </div>
  );
}

export default App;