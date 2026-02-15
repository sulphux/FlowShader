import React, { useState, useMemo, useEffect } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';
import type { Node } from 'reactflow';
import { MultiTypeIndicator } from './MultiTypeIndicator';
import { loadCustomNodes } from '../core/customNodeManager';

interface Props {
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_pow"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_abs", "math_exp"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_length", "vec_fract", "math_mix", "relay_auto"],
  "Utils": [
    "special_note", "special_group", 
    "smart_split",
    "smart_compose",
    "monitor",
    "preview"
  ],
  "Color & Shapes": ["palette", "color_add", "color_mult", "sdf_circle"]
};

export default function Sidebar({ nodes, setNodes, currentContext = 'Main' }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'lib' | 'params'>('lib');
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  
  // Load custom nodes dynamically - refresh when refreshKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customNodes = useMemo(() => loadCustomNodes(), [refreshKey]);
  
  // Listen for custom storage events to refresh
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customNodes') {
        setRefreshKey(prev => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event from same window
    const handleCustomUpdate = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('customNodesUpdated', handleCustomUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customNodesUpdated', handleCustomUpdate);
    };
  }, []);
  
  // Build menu structure with custom nodes
  const menuStructure = useMemo(() => {
    const base = { ...MENU_STRUCTURE };
    
    if (currentContext !== 'Main') {
      // In subgraph - show Custom Input/Output
      base["Custom Nodes"] = ["custom_input", "custom_output", ...customNodes.map(n => n.id)];
    } else {
      // In Main - only user custom nodes (hide Custom Input/Output)
      if (customNodes.length > 0) {
        base["Custom Nodes"] = customNodes.map(n => n.id);
      } else {
        // No custom nodes at all - remove category
        delete base["Custom Nodes"];
      }
    }
    
    return base;
  }, [customNodes, currentContext]);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDeleteCustomNode = (nodeId: string) => {
    console.log('🗑️ DELETE CUSTOM NODE:', nodeId);
    
    // Check if node exists
    const customNodes = loadCustomNodes();
    const nodeExists = customNodes.some(n => n.id === nodeId);
    console.log('Node exists in library:', nodeExists);
    
    if (!nodeExists) {
      alert(`❌ Custom node "${nodeId}" not found!`);
      setContextMenu(null);
      return;
    }
    
    // Check if used on canvas
    const usedOnCanvas = nodes.some(n => {
      const defId = n.data?.definition?.id;
      console.log(`Checking node ${n.id}: definition.id = ${defId}`);
      return defId === nodeId;
    });
    
    console.log('Used on canvas:', usedOnCanvas);
    
    if (usedOnCanvas) {
      const confirmed = window.confirm(
        `⚠️ This custom node is currently used on the canvas.\n\nDelete anyway?`
      );
      console.log('User confirmed:', confirmed);
      
      if (!confirmed) {
        console.log('❌ User cancelled');
        setContextMenu(null);
        return;
      }
    }
    
    try {
      console.log('Deleting from localStorage...');
      deleteCustomNode(nodeId);
      
      console.log('Deleting from NODE_REGISTRY...');
      const registryBefore = Object.keys(NODE_REGISTRY).includes(nodeId);
      delete (NODE_REGISTRY as Record<string, unknown>)[nodeId];
      const registryAfter = Object.keys(NODE_REGISTRY).includes(nodeId);
      console.log(`Registry: before=${registryBefore}, after=${registryAfter}`);
      
      console.log('Forcing sidebar refresh...');
      setRefreshKey(prev => prev + 1);  // Direct state update
      window.dispatchEvent(new Event('customNodesUpdated'));
      
      console.log('✅ Deletion complete!');
      alert(`✅ Custom node deleted successfully!`);
      
    } catch (error) {
      console.error('❌ Deletion failed:', error);
      alert(`❌ Failed to delete: ${error}`);
    }
    
    setContextMenu(null);
  };

  // --- LOGIKA PARAMETRÓW ---
  // Znajdujemy unikalne parametry (np. wszystkie "Speed" traktujemy jako jeden wpis)
  const uniqueParams = useMemo(() => {
      const params = new Map();
      nodes.forEach(node => {
          const def = node.data.definition;
          // Sprawdzamy czy to param (float lub color) i czy ma controls
          if (def && (def.id === 'param_float' || def.id === 'param_color')) {
              const label = node.data.label || def.label;
              if (!params.has(label)) {
                  params.set(label, {
                      id: node.id, // ID pierwszego wystąpienia (do klucza)
                      label: label,
                      type: def.id, // param_float lub param_color
                      value: node.data.value ?? def.controls?.defaultValue,
                      // Dla float
                      min: node.data.min ?? def.controls?.min ?? 0,
                      max: node.data.max ?? def.controls?.max ?? 1,
                      step: def.controls?.step ?? 0.01
                  });
              }
          }
      });
      return Array.from(params.values());
  }, [nodes]);

  // Funkcja aktualizująca WSZYSTKIE nody o tej samej nazwie
  const updateGlobalParam = (label: string, value: unknown) => {
      setNodes(nds => nds.map(n => {
          // Jeśli nazwa się zgadza i typ noda to param -> aktualizuj
          const nLabel = n.data.label || n.data.definition.label;
          if (nLabel === label && (n.data.definition.id === 'param_float' || n.data.definition.id === 'param_color')) {
              return {
                  ...n,
                  data: { ...n.data, value }
              };
          }
          return n;
      }));
  };

  if (collapsed) {
      return (
          <div style={{ width: '40px', height: '100%', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px' }}>
              <button onClick={() => setCollapsed(false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' }}>☰</button>
          </div>
      )
  }

  return (
    <div style={{ width: '240px', height: '100%', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER Z TABAMI */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          <button 
            onClick={() => setActiveTab('lib')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'lib' ? '#222' : 'transparent', border: 'none', color: activeTab === 'lib' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
          >
            LIBRARY
          </button>
          <button 
            onClick={() => setActiveTab('params')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'params' ? '#222' : 'transparent', border: 'none', color: activeTab === 'params' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
          >
            PARAMS ({uniqueParams.length})
          </button>
          <button onClick={() => setCollapsed(true)} style={{ width: '30px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>◀</button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        
        {/* ZAKŁADKA BIBLIOTEKI (Stara) */}
        {activeTab === 'lib' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(menuStructure).map(([category, items]) => (
                    <div key={category}>
                        <div style={{ color: '#666', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{category}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {items.map(id => {
                                const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                                if(!def) return null;
                                
                                const firstInput = def.inputs[0];
                                const firstOutput = def.outputs[0];
                                const inputType = firstInput?.type || null;
                                const outputType = firstOutput?.type || null;
                                
                                return (
                                    <div 
                                        key={id}
                                        onDragStart={(event) => onDragStart(event, id)}
                                        onContextMenu={(event) => {
                                          // Only allow context menu for custom nodes
                                          if (id.startsWith('custom_') && id !== 'custom_input' && id !== 'custom_output') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setContextMenu({ x: event.clientX, y: event.clientY, nodeId: id });
                                          }
                                        }}
                                        draggable
                                        style={{ 
                                            background: '#222', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', 
                                            color: '#ccc', fontSize: '12px', cursor: 'grab', display: 'flex', alignItems: 'center', 
                                            justifyContent: 'space-between',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Input color indicator */}
                                            {inputType && (
                                              inputType.includes('|') ? (
                                                <MultiTypeIndicator types={inputType} size={8} />
                                              ) : (
                                                <div 
                                                  className={inputType === 'auto' ? 'port-auto-static' : ''}
                                                  style={{ 
                                                    width: '8px', 
                                                    height: '8px', 
                                                    borderRadius: '50%', 
                                                    background: inputType === 'auto' ? undefined : (TYPE_COLORS[inputType] || '#666'),
                                                    opacity: 0.7
                                                  }} 
                                                />
                                              )
                                            )}
                                            <span>{def.label}</span>
                                        </div>
                                        {/* Output color indicator */}
                                        {outputType && (
                                          outputType.includes('|') ? (
                                            <MultiTypeIndicator types={outputType} size={8} />
                                          ) : (
                                            <div 
                                              className={outputType === 'auto' ? 'port-auto-static' : ''}
                                              style={{ 
                                                width: '8px', 
                                                height: '8px', 
                                                borderRadius: '50%', 
                                                background: outputType === 'auto' ? undefined : (TYPE_COLORS[outputType] || '#fff')
                                              }} 
                                            />
                                          )
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* ZAKŁADKA PARAMETRÓW (Nowa) */}
        {activeTab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {uniqueParams.length === 0 && <div style={{ color: '#444', fontStyle: 'italic', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No parameters yet.<br/>Add "Float Param" node.</div>}
                
                {uniqueParams.map(p => (
                    <div key={p.label} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ccc', marginBottom: '6px' }}>{p.label}</div>
                        
                        {/* EDYCJA FLOAT */}
                        {p.type === 'param_float' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input 
                                    type="range" 
                                    min={p.min} max={p.max} step={p.step} 
                                    value={p.value} 
                                    onChange={(e) => updateGlobalParam(p.label, e.target.value)}
                                    style={{ flex: 1, accentColor: '#ff007a', height: '4px' }} 
                                />
                                <input 
                                    type="number" 
                                    value={p.value} 
                                    onChange={(e) => updateGlobalParam(p.label, e.target.value)}
                                    style={{ width: '40px', background: '#222', border: 'none', color: '#ff007a', fontSize: '11px', textAlign: 'right', borderRadius: '3px' }}
                                />
                            </div>
                        )}

                        {/* EDYCJA KOLORU */}
                        {p.type === 'param_color' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    type="color" 
                                    value={p.value} 
                                    onChange={(e) => updateGlobalParam(p.label, e.target.value)}
                                    style={{ width: '100%', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }} 
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}

      </div>
      
      {/* Context menu for custom nodes */}
      {contextMenu && (
        <>
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 9998 
            }} 
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 9999,
              background: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              minWidth: '150px',
            }}
          >
            <button
              onClick={() => handleDeleteCustomNode(contextMenu.nodeId)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#ff4444',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2a2a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              🗑️ Delete Custom Node
            </button>
          </div>
        </>
      )}
    </div>
  );
}