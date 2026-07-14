/* eslint-disable react-hooks/set-state-in-effect */
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';
import { validateConnection } from '../core/connectionValidator';
import { useI18n } from '../core/i18n';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (typeId: string) => void;
  filterType?: string | null;
  /** Skąd ciągnięto połączenie: 'source' = z wyjścia (szukamy nodów z pasującym WEJŚCIEM),
   *  'target' = z wejścia (szukamy nodów z pasującym WYJŚCIEM). */
  filterDirection?: 'source' | 'target' | null;
  onPaste?: () => void;
  onCreateCustom?: (mode: 'empty' | 'selection') => void;
  hasClipboard?: boolean;
  hasSelection?: boolean;
}

/** Połączenie "pasuje", gdy jest poprawne wprost albo auto-adapter je obsłuży. */
const connectionWorks = (sourceType: string, targetType: string): boolean => {
  const result = validateConnection(sourceType, targetType);
  return result.valid || Boolean(result.requiresAdapter);
};

export const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv", "texture_2d", "audio_input"],
  "Custom Nodes": ["custom_input", "custom_output"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_mod", "math_pow", "math_sqrt", "math_inversesqrt", "math_floor", "math_ceil", "math_round", "math_sign"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_tan", "math_cot", "math_asin", "math_acos", "math_atan", "math_atan2", "math_radians", "math_degrees", "math_abs", "math_exp", "math_exp2", "math_log", "math_log2", "math_fract"],
  "Math (Range)": ["math_step", "math_smoothstep", "math_min", "math_max", "math_clamp", "math_mix_float"],
  "Vector (Basic)": ["vec_add2", "vec_sub2", "vec_mult2", "vec_scale2", "vec_div2", "vec_add3", "vec_sub3", "vec_mult3", "vec_scale3", "vec_div3"],
  "Vector (Geometry)": ["vec_length", "vec_length3", "vec_normalize2", "vec_normalize3", "vec_dot2", "vec_dot3", "vec_distance2", "vec_distance3", "vec_cross3", "vec_reflect3", "vec_refract3", "vec_faceforward3"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_fract", "math_mix", "relay_auto"],
  "Utils": ["special_note", "special_group", "smart_split", "smart_compose", "monitor", "preview", "color_preview", "code_glsl", "code_block"],
  "Simulation": ["feedback", "sample_buffer", "impulse", "math_random", "loop_iterate"],
  "Color & Shapes": ["palette", "color_add", "color_mult", "mono", "sdf_circle"]
};

export default function ContextMenu({ x, y, onClose, onAddNode, filterType, filterDirection, onPaste, onCreateCustom, hasClipboard, hasSelection }: Props) {
  const { text } = useI18n();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [openLeft, setOpenLeft] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const submenuWidth = 200;
      
      let newX = x;
      let newY = y;
      
      if (y + rect.height > window.innerHeight) {
        newY = Math.max(0, y - rect.height);
      }
      
      if (x + rect.width > window.innerWidth) {
        newX = Math.max(0, x - rect.width);
      }
      
      setAdjustedPos({ x: newX, y: newY });
      setOpenLeft(newX + rect.width + submenuWidth > window.innerWidth);
    }
  }, [x, y]);

  const isNodeCompatible = useCallback((nodeId: string) => {
      if (!filterType) return true;
      const def = NODE_REGISTRY[nodeId as keyof typeof NODE_REGISTRY];
      if (!def) return false;

      // Ciągnięto z WYJŚCIA → nowy node musi mieć wejście przyjmujące filterType
      const hasMatchingInput = def.inputs.some(input => connectionWorks(filterType, input.type));
      // Ciągnięto z WEJŚCIA → nowy node musi mieć wyjście produkujące filterType
      const hasMatchingOutput = def.outputs.some(output => connectionWorks(output.type, filterType));

      if (filterDirection === 'source') return hasMatchingInput;
      if (filterDirection === 'target') return hasMatchingOutput;
      return hasMatchingOutput || hasMatchingInput;
  }, [filterType, filterDirection]);

  const filteredStructure = useMemo(() => {
      if (!filterType) return MENU_STRUCTURE;
      const newStruct: Record<string, string[]> = {};
      Object.entries(MENU_STRUCTURE).forEach(([cat, items]) => {
          const compatibleItems = items.filter(isNodeCompatible);
          if (compatibleItems.length > 0) newStruct[cat] = compatibleItems;
      });
      return newStruct;
  }, [filterType, isNodeCompatible]);

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
        {/* Actions Section (for pane context menu) */}
        {!filterType && (onPaste || onCreateCustom) && (
          <>
            {onPaste && (
              <div 
                onClick={() => { onPaste(); onClose(); }} 
                style={{ ...itemStyle(false), opacity: hasClipboard ? 1 : 0.3, cursor: hasClipboard ? 'pointer' : 'not-allowed' }}
                onMouseEnter={(e) => { if (hasClipboard) { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
              >
                📋 {text('Paste', 'Wklej')} (Ctrl+V)
              </div>
            )}
            {onCreateCustom && (
              <>
                <div
                  onClick={() => { onCreateCustom('empty'); onClose(); }}
                  style={{ ...itemStyle(false), opacity: 1, cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
                >
                  📦 {text('Create Custom Node (Empty)', 'Utwórz Custom Node (pusty)')}
                </div>
                {hasSelection && (
                  <div
                    onClick={() => { onCreateCustom('selection'); onClose(); }}
                    style={{ ...itemStyle(false), opacity: 1, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
                  >
                    📦 {text('Create Custom Node from Selection', 'Utwórz Custom Node z zaznaczenia')}
                  </div>
                )}
              </>
            )}
            <div style={{ height: '1px', background: '#333', margin: '4px 0' }}></div>
          </>
        )}
        
        {filterType && (
            <div style={{ padding: '4px 8px', fontSize: '10px', color: '#888', borderBottom: '1px solid #333', marginBottom: '4px' }}>
                {text('Compatible with:', 'Zgodne z:')} <strong style={{color: TYPE_COLORS[filterType] || '#fff'}}>{filterType}</strong>
            </div>
        )}

        {Object.entries(filteredStructure).map(([category, items]) => (
          <div key={category} onMouseEnter={() => setActiveCategory(category)} style={{ position: 'relative' }}>
            <div style={itemStyle(activeCategory === category)}>
              <span>{text(category, ({
                'Output & Inputs': 'Wyjście i wejścia', 'Math (Basic)': 'Matematyka (podstawy)',
                'Math (Trig/Func)': 'Matematyka (funkcje)', 'Math (Range)': 'Matematyka (zakres)',
                'Vector (Basic)': 'Wektory (podstawy)', 'Vector (Geometry)': 'Wektory (geometria)',
                'Vector & Space': 'Wektory i przestrzeń', Utils: 'Narzędzia', Simulation: 'Symulacja',
                'Color & Shapes': 'Kolor i kształty', 'Custom Nodes': 'Custom Nody',
              } as Record<string, string>)[category])}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{openLeft ? '◀' : '▶'}</span>
            </div>
            
            {/* SUBSZUFLADA */}
            {activeCategory === category && (
              <div style={{
                position: 'absolute', 
                top: -4, // Lekka korekta, żeby było równo z itemem
                // FLIP LOGIC:
                left: openLeft ? 'auto' : '100%', 
                right: openLeft ? '100%' : 'auto',
                marginLeft: openLeft ? 0 : '4px',
                marginRight: openLeft ? '4px' : 0,
                
                background: '#1a1a1a', border: '1px solid #444', borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.8)', padding: '4px',
                minWidth: '180px', maxHeight: '400px', overflowY: 'auto',
                zIndex: 100001
              }}>
                 {items.map((id) => {
                   const def = NODE_REGISTRY[id as keyof typeof NODE_REGISTRY];
                   if (!def) return null;
                   const outType = def.outputs[0]?.type || 'default';
                   const isAuto = outType === 'auto';
                   return (
                    <div
                      key={id}
                      onClick={() => { onAddNode(id); onClose(); }}
                      style={{ ...itemStyle(false), justifyContent: 'flex-start', gap: '8px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
                    >
                      <div 
                        className={isAuto ? 'port-auto-static' : ''}
                        style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: isAuto ? undefined : (TYPE_COLORS[outType] || '#fff')
                        }} 
                      />
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
