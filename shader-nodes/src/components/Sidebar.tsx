import React, { useState, useMemo } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';
import type { Node } from 'reactflow';

interface Props {
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_pow"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_abs", "math_exp"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_length", "vec_fract", "math_mix", "relay_float", "relay_vec3"],
  "Utils": ["special_note", "special_group", "split_vec2", "split_vec3", "split_vec4", "combine_vec2", "combine_vec3", "combine_vec4", "preview"],
  "Color & Shapes": ["palette", "color_add", "color_mult", "sdf_circle"]
};

export default function Sidebar({ nodes, setNodes }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'lib' | 'params'>('lib');

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
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
  const updateGlobalParam = (label: string, value: any) => {
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
                {Object.entries(MENU_STRUCTURE).map(([category, items]) => (
                    <div key={category}>
                        <div style={{ color: '#666', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{category}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {items.map(id => {
                                const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                                if(!def) return null;
                                const outType = def.outputs[0]?.type || 'default';
                                
                                return (
                                    <div 
                                        key={id}
                                        onDragStart={(event) => onDragStart(event, id)}
                                        draggable
                                        style={{ 
                                            background: '#222', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', 
                                            color: '#ccc', fontSize: '12px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '8px',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
                                    >
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TYPE_COLORS[outType] || '#fff' }} />
                                        {def.label}
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
    </div>
  );
}