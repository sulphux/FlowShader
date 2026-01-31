import React, { useState } from 'react';
import { NODE_REGISTRY } from '../nodes';
import { TYPE_COLORS } from '../core/theme';

// Skopiowana struktura z ContextMenu dla spójności
const MENU_STRUCTURE = {
  "Output & Inputs": ["output", "time", "param_float", "param_color", "uv"],
  "Math (Basic)": ["math_add", "math_sub", "math_mult", "math_div", "math_negate", "math_pow"],
  "Math (Trig/Func)": ["math_sin", "math_cos", "math_abs", "math_exp"],
  "Vector & Space": ["uv_scale", "uv_shift", "vec_length", "vec_fract", "math_mix", "relay_float", "relay_vec3"],
  "Utils": ["special_note", "special_group", "split_vec2", "split_vec3", "split_vec4", "combine_vec2", "combine_vec3", "combine_vec4", "preview"],
  "Color & Shapes": ["palette", "color_add", "color_mult", "sdf_circle"]
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  if (collapsed) {
      return (
          <div style={{ width: '40px', height: '100%', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px' }}>
              <button onClick={() => setCollapsed(false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' }}>☰</button>
          </div>
      )
  }

  return (
    <div style={{ width: '220px', height: '100%', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#eee', fontWeight: 'bold', fontSize: '12px' }}>
          <span>TOOLBOX</span>
          <button onClick={() => setCollapsed(true)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>◀</button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
    </div>
  );
}