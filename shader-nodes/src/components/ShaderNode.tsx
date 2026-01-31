import { memo, useCallback, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import type { ShaderNodeDefinition } from '../core/types';
import { TYPE_COLORS } from '../core/theme';

export const ShaderNode = memo(({ id, data, selected }: NodeProps) => {
  const def = data.definition as ShaderNodeDefinition;
  const { setNodes } = useReactFlow();
  const [showSettings, setShowSettings] = useState(false);

  const updateNodeData = useCallback((changes: Record<string, any>) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, ...changes } } : node));
  }, [id, setNodes]);

  const currentValue = data.value ?? def.controls?.defaultValue;
  const currentLabel = data.label ?? def.label;
  const currentMin = data.min ?? def.controls?.min ?? 0;
  const currentMax = data.max ?? def.controls?.max ?? 1;
  const currentStep = def.controls?.step ?? 0.01;

  const isNote = def.id === 'special_note';
  const isGroup = def.id === 'special_group';
  
  // Kolor nagłówka
  const primaryOutputType = def.outputs[0]?.type || 'default';
  const headerColorBase = TYPE_COLORS[primaryOutputType] || '#555';

  const baseStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    color: '#fff',
    fontFamily: 'sans-serif',
    boxShadow: selected ? '0 0 15px rgba(255, 0, 122, 0.4)' : '0 4px 8px rgba(0,0,0,0.5)',
    transition: 'all 0.1s',
    borderRadius: '6px', // Mniejsze zaokrąglenie
  };

  // --- 1. NOTATKA (Bez zmian) ---
  if (isNote) {
      return (
        <>
            <NodeResizer minWidth={160} minHeight={100} isVisible={selected} lineStyle={{ border: '1px solid #ff007a' }} />
            <div style={{ ...baseStyle, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#4e342e', border: selected ? '1px solid #ff007a' : '1px solid #6d4c41', overflow: 'hidden' }}>
                <div style={{ padding: '4px', background: 'rgba(0,0,0,0.2)' }}>
                    <input className="nodrag" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" style={{ background: 'transparent', border: 'none', color: '#ffcc80', fontWeight: 'bold', fontSize: '11px', width: '100%', outline: 'none', textAlign: 'center' }} placeholder="Title" />
                </div>
                <textarea className="nodrag" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} spellCheck={false} style={{ flex: 1, width: '100%', resize: 'none', background: 'transparent', border: 'none', color: '#ffe082', fontFamily: 'monospace', fontSize: '12px', padding: '8px', outline: 'none' }} />
            </div>
        </>
      );
  }
  
  // --- 2. GRUPA (Bez zmian) ---
  if (isGroup) {
      const groupColor = data.value || 'rgba(255, 255, 255, 0.05)';
      return (
        <>
            <NodeResizer minWidth={200} minHeight={150} isVisible={selected} lineStyle={{ border: '1px solid rgba(255,255,255,0.3)' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: groupColor, border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', zIndex: -1, pointerEvents: 'none' }}>
                 <div className="nodrag" style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'all' }}>
                    <input className="nodrag" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '24px', fontWeight: 'bold', width: '80%', outline: 'none' }} spellCheck={false} />
                    <input type="color" value={data.value || '#ffffff'} onChange={(e) => { const hex = e.target.value; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); updateNodeData({ value: `rgba(${r}, ${g}, ${b}, 0.15)` }); }} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5 }} />
                 </div>
            </div>
        </>
      );
  }

  // --- 3. RENDEROWANIE KOMPAKTOWE (Pastylka) ---
  // To dotyczy Length, Sin, Add itp. (wszystkich z compact: true)
  if (def.compact) {
    return (
      <div style={{ ...baseStyle, borderRadius: '16px', padding: '0 12px', minWidth: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* INPUTY (Lewa strona, idealnie w linii środka) */}
        <div style={{ position: 'absolute', left: '-6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {def.inputs.map((input, i) => {
                 // Centrowanie pinów
                 let topOffset = 0;
                 if(def.inputs.length > 1) topOffset = (i - (def.inputs.length - 1)/2) * 12;
                 return <Handle key={input.id} type="target" position={Position.Left} id={input.id} style={{ background: TYPE_COLORS[input.type], width: '10px', height: '10px', border: '2px solid #1a1a1a', left: 0, top: topOffset, transform: 'translate(0, -50%)' }} />
            })}
        </div>
        
        {/* LABEL (Środek) */}
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{currentLabel}</span>

        {/* OUTPUTY (Prawa strona, idealnie w linii środka) */}
        <div style={{ position: 'absolute', right: '-6px' }}>
            {def.outputs.map((output) => (
                <Handle key={output.id} type="source" position={Position.Right} id={output.id} style={{ background: TYPE_COLORS[output.type], width: '10px', height: '10px', border: '2px solid #1a1a1a', right: 0, top: 0, transform: 'translate(0, -50%)' }} />
            ))}
        </div>
      </div>
    );
  }

  // --- 4. RENDEROWANIE STANDARDOWE (Np. UV Coord, Output, Parametry) ---
  // Tutaj też robimy "ciasno"
  return (
    <div style={{ ...baseStyle, minWidth: '140px' }}>
      {/* Cienki pasek koloru na górze zamiast grubego nagłówka */}
      <div style={{ height: '4px', background: headerColorBase, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
      
      {/* Nazwa noda */}
      <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333' }}>
        <input className="nodrag" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" style={{ background: 'transparent', border: 'none', color: '#eee', fontWeight: 'bold', fontSize: '12px', width: '100%', outline: 'none' }} />
      </div>
      
      <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        
        {/* INPUTS & OUTPUTS W JEDNYM WIERSZU (Jeśli to możliwe) */}
        {/* To sprawi, że input i output będą na tym samym poziomie, jeśli node ma po jednym */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
            {/* Lewa kolumna: Inputy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {def.inputs.map((input) => (
                    <div key={input.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                        <Handle type="target" position={Position.Left} id={input.id} style={{ background: TYPE_COLORS[input.type], width: '10px', height: '10px', left: '-13px', border: '2px solid #1a1a1a' }} />
                        <span style={{ fontSize: '10px', color: '#ccc' }}>{input.label}</span>
                    </div>
                ))}
            </div>

            {/* Prawa kolumna: Outputy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {def.outputs.map((output) => (
                    <div key={output.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                        <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>{output.label}</span>
                        <Handle type="source" position={Position.Right} id={output.id} style={{ background: TYPE_COLORS[output.type], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }} />
                    </div>
                ))}
            </div>
        </div>

        {/* SUWAKI (Zawsze na dole, jeśli są) */}
        {def.controls && (
            <div style={{ padding: '4px 8px', marginTop: '4px' }}>
                {def.controls.type === 'float' && (
                    <>
                        <div className="nodrag" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <input type="range" min={currentMin} max={currentMax} step={currentStep} value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ flex: 1, cursor: 'pointer', accentColor: '#ff007a', height: '6px' }} />
                            <input type="number" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ background: '#111', border: '1px solid #555', color: '#fff', fontSize: '11px', width: '40px', textAlign: 'center', borderRadius: '4px', padding: '2px', outline: 'none' }} />
                            <div onClick={() => setShowSettings(!showSettings)} style={{ cursor: 'pointer', fontSize: '10px', color: showSettings ? '#ff007a' : '#555', padding: '2px' }}>⚙️</div>
                        </div>
                        {showSettings && (
                            <div className="nodrag" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', background: '#222', padding: '2px', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MIN</span><input type="number" value={currentMin} onChange={(e) => updateNodeData({ min: parseFloat(e.target.value) })} style={{ background: '#111', border: 'none', color: '#aaa', fontSize: '9px', width: '25px', textAlign: 'center' }} /></div>
                                <div style={{ display: 'flex', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MAX</span><input type="number" value={currentMax} onChange={(e) => updateNodeData({ max: parseFloat(e.target.value) })} style={{ background: '#111', border: 'none', color: '#aaa', fontSize: '9px', width: '25px', textAlign: 'center' }} /></div>
                            </div>
                        )}
                    </>
                )}
                {def.controls.type === 'color' && (
                    <div className="nodrag"><input type="color" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ width: '100%', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }} /></div>
                )}
            </div>
        )}
      </div>
    </div>
  );
});