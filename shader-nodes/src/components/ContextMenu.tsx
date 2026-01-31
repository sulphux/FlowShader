import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (typeId: string) => void;
  filterType?: string | null;
}

const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_pow"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_abs", "math_exp"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_length", "vec_fract", "math_mix", "relay_float", "relay_vec3"],
  "Utils": ["special_note", "special_group", "split_vec2", "split_vec3", "split_vec4", "combine_vec2", "combine_vec3", "combine_vec4", "preview"],
  "Color & Shapes": ["palette", "color_add", "color_mult", "sdf_circle"]
};

export default function ContextMenu({ x, y, onClose, onAddNode, filterType }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [openLeft, setOpenLeft] = useState(false); // NOWE: Czy otwierać w lewo?

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      
      // Główne menu - sprawdzenie krawędzi
      if (x + rect.width > window.innerWidth) newX = x - rect.width;
      if (y + rect.height > window.innerHeight) newY = y - rect.height;
      
      setAdjustedPos({ x: newX, y: newY });

      // Decyzja dla Submenu: jeśli po prawej jest mało miejsca, otwieramy w lewo
      if (newX + rect.width + 180 > window.innerWidth) {
          setOpenLeft(true);
      } else {
          setOpenLeft(false);
      }
    }
  }, [x, y]);

  // (reszta bez zmian: isNodeCompatible, filteredStructure)
  const isNodeCompatible = (nodeId: string) => {
      if (!filterType) return true;
      const def = NODE_REGISTRY[nodeId as keyof typeof NODE_REGISTRY];
      if (!def) return false;
      return def.inputs.some(input => {
          if (filterType === 'float') return true; 
          if (input.type === filterType) return true;
          if (input.type === 'vec3' && filterType === 'float') return true; 
          return false;
      });
  };

  const filteredStructure = useMemo(() => {
      if (!filterType) return MENU_STRUCTURE;
      const newStruct: Record<string, string[]> = {};
      Object.entries(MENU_STRUCTURE).forEach(([cat, items]) => {
          const compatibleItems = items.filter(isNodeCompatible);
          if (compatibleItems.length > 0) newStruct[cat] = compatibleItems;
      });
      return newStruct;
  }, [filterType]);

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
    zIndex: 100000,
    fontFamily: 'sans-serif',
    userSelect: 'none'
  };

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px', cursor: 'pointer', fontSize: '13px',
    color: isActive ? '#fff' : '#ccc',
    background: isActive ? '#ff007a' : 'transparent',
    borderRadius: '4px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    transition: 'background 0.1s'
  });

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }} 
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div ref={menuRef} style={menuStyle} onClick={(e) => e.stopPropagation()}>
        {filterType && (
            <div style={{ padding: '4px 8px', fontSize: '10px', color: '#888', borderBottom: '1px solid #333', marginBottom: '4px' }}>
                Compatible with: <strong style={{color: TYPE_COLORS[filterType] || '#fff'}}>{filterType}</strong>
            </div>
        )}

        {Object.entries(filteredStructure).map(([category, items]) => (
          <div key={category} onMouseEnter={() => setActiveCategory(category)} style={{ position: 'relative' }}>
            <div style={itemStyle(activeCategory === category)}>
              <span>{category}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>▶</span>
            </div>
            {activeCategory === category && (
              <div style={{
                position: 'absolute', top: 0,
                // SMART POSITIONING:
                left: openLeft ? 'auto' : '100%', 
                right: openLeft ? '100%' : 'auto',
                marginLeft: openLeft ? 0 : '6px',
                marginRight: openLeft ? '6px' : 0,
                background: '#1a1a1a', border: '1px solid #444', borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.8)', padding: '4px',
                minWidth: '180px', maxHeight: '400px', overflowY: 'auto'
              }}>
                 {items.map((id) => {
                   const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                   if (!def) return null;
                   const outType = def.outputs[0]?.type || 'default';
                   return (
                    <div
                      key={id}
                      onClick={() => { onAddNode(id); onClose(); }}
                      style={{ ...itemStyle(false), justifyContent: 'flex-start', gap: '8px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TYPE_COLORS[outType] || '#fff' }} />
                      {def.label}
                    </div>
                   );
                 })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}