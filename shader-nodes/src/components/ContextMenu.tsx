import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (typeId: string) => void;
}

const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_pow"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_abs", "math_exp"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_length", "vec_fract", "math_mix", "relay_float", "relay_vec3"],
  "Utils (Split/Join)": ["special_note", "special_group", "split_vec2", "split_vec3", "split_vec4", "combine_vec2", "combine_vec3", "combine_vec4"],
  "Color & Shapes": ["palette", "color_add", "color_mult", "sdf_circle"]
};

export default function ContextMenu({ x, y, onClose, onAddNode }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  // Inteligentne pozycjonowanie (żeby nie uciekało za ekran)
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;

      // Jeśli wychodzi za prawo
      if (x + rect.width > window.innerWidth) {
        newX = x - rect.width;
      }
      // Jeśli wychodzi za dół
      if (y + rect.height > window.innerHeight) {
        newY = y - rect.height;
      }
      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  const remainingNodes = useMemo(() => {
    const usedKeys = new Set(Object.values(MENU_STRUCTURE).flat());
    return Object.keys(NODE_REGISTRY).filter(key => !usedKeys.has(key));
  }, []);

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: adjustedPos.y,
    left: adjustedPos.x,
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
    padding: '4px',
    minWidth: '160px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 10000, // Bardzo wysoki Z-Index (nad Preview)
    fontFamily: 'sans-serif',
    userSelect: 'none'
  };

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: isActive ? '#fff' : '#ccc',
    background: isActive ? '#ff007a' : 'transparent',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.1s'
  });

  const submenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '100%', 
    marginLeft: '6px',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
    padding: '4px',
    minWidth: '180px',
    maxHeight: '400px',
    overflowY: 'auto'
  };

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} 
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }} // Prawy klik zamyka
    >
      <div ref={menuRef} style={menuStyle} onClick={(e) => e.stopPropagation()}>
        {Object.entries(MENU_STRUCTURE).map(([category, items]) => (
          <div key={category} onMouseEnter={() => setActiveCategory(category)} style={{ position: 'relative' }}>
            <div style={itemStyle(activeCategory === category)}>
              <span>{category}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>▶</span>
            </div>
            {activeCategory === category && (
              <div style={submenuStyle}>
                 {items.map((id) => {
                   const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                   if (!def) return null;
                   const outType = def.outputs[0]?.type || 'default';
                   const dotColor = TYPE_COLORS[outType] || '#fff';

                   return (
                    <div
                      key={id}
                      onClick={() => { onAddNode(id); onClose(); }}
                      style={{ ...itemStyle(false), justifyContent: 'flex-start', gap: '8px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
                      {def.label}
                    </div>
                   );
                 })}
              </div>
            )}
          </div>
        ))}
        {remainingNodes.length > 0 && <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />}
        {remainingNodes.length > 0 && (
           <div onMouseEnter={() => setActiveCategory("OTHER")} style={{ position: 'relative' }}>
             <div style={itemStyle(activeCategory === "OTHER")}>
                <span>Other</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>▶</span>
             </div>
             {activeCategory === "OTHER" && (
                <div style={submenuStyle}>
                    {remainingNodes.map((id) => {
                        const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                        return (
                            <div
                                key={id}
                                onClick={() => { onAddNode(id); onClose(); }}
                                style={{ ...itemStyle(false) }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {def.label}
                            </div>
                        );
                    })}
                </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}