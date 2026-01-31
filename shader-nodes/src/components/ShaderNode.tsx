import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow'; // <--- Import NodeResizer
import type { ShaderNodeDefinition } from '../core/types';
import { TYPE_COLORS } from '../core/theme';

export const ShaderNode = memo(({ id, data, selected }: NodeProps) => {
  const def = data.definition as ShaderNodeDefinition;
  const { setNodes } = useReactFlow();

  const updateNodeData = useCallback((changes: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, ...changes },
          };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const currentValue = data.value ?? def.controls?.defaultValue;
  const currentLabel = data.label || def.label;
  const currentMin = data.min ?? def.controls?.min ?? 0;
  const currentMax = data.max ?? def.controls?.max ?? 1;
  const currentStep = def.controls?.step ?? 0.01;

  // Czy to jest Notatka?
  const isNote = def.id === 'special_note';

  // --- STYLE PODSTAWOWE ---
  const baseStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    color: '#fff',
    fontFamily: 'sans-serif',
    boxShadow: selected ? '0 0 15px rgba(255, 0, 122, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
    transition: 'box-shadow 0.2s, border 0.2s',
  };

  // --- 1. RENDEROWANIE NOTATKI (Resizable) ---
  if (isNote) {
      return (
        <>
            {/* Uchwyty zmiany rozmiaru (widoczne tylko po zaznaczeniu) */}
            <NodeResizer 
                minWidth={160} 
                minHeight={100} 
                isVisible={selected} 
                lineStyle={{ border: '1px solid #ff007a' }} 
                handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
            />
            
            <div style={{
                ...baseStyle,
                width: '100%',      // Wypełnia rozmiar noda ustalony przez Resizer
                height: '100%',     // Wypełnia rozmiar noda
                display: 'flex',
                flexDirection: 'column',
                background: '#4e342e', // Lekko brązowe tło dla całej notatki
                border: selected ? '1px solid #ff007a' : '1px solid #6d4c41',
                borderRadius: '6px',
                overflow: 'hidden'
            }}>
                {/* Nagłówek Notatki */}
                <div style={{ padding: '4px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(0,0,0,0.2)' }}>
                    <input 
                        className="nodrag"
                        value={currentLabel}
                        onChange={(e) => updateNodeData({ label: e.target.value })}
                        spellCheck={false}
                        autoComplete="off"
                        style={{
                            background: 'transparent', border: 'none', color: '#ffcc80',
                            fontWeight: 'bold', fontSize: '11px', width: '100%', outline: 'none', textAlign: 'center'
                        }}
                        placeholder="Title"
                    />
                </div>

                {/* Obszar Tekstowy */}
                <textarea
                    className="nodrag" // Ważne: pozwala zaznaczać tekst myszką
                    value={currentValue}
                    onChange={(e) => updateNodeData({ value: e.target.value })}
                    placeholder="Type comments here..."

                    // ----------------------
                    spellCheck={false}        // Wyłącza czerwone wężyki
                    autoComplete="off"        // Wyłącza podpowiedzi przeglądarki
                    autoCorrect="off"         // Wyłącza korektę mobilną/macOS
                    autoCapitalize="off"      // Wyłącza duże litery na początku
                    // ----------------------

                    style={{
                        flex: 1, // Zajmij resztę miejsca
                        width: '100%',
                        resize: 'none', // Wyłączamy standardowy uchwyt przeglądarki
                        background: 'transparent',
                        border: 'none',
                        color: '#ffe082',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        lineHeight: '1.4'
                    }}
                />
            </div>
        </>
      );
  }
  
  const isGroup = def.id === 'special_group'; // <--- NOWE

  // --- STYLE GRUPY ---
  if (isGroup) {
      // Pobieramy kolor (możesz dodać color picker w controls jeśli chcesz, tu hardcoduję)
      const groupColor = 'rgba(255, 255, 255, 0.05)'; 

      return (
        <>
            <NodeResizer 
                minWidth={200} 
                minHeight={150} 
                isVisible={selected} 
                lineStyle={{ border: '1px solid rgba(255,255,255,0.3)' }} 
                handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
            />
            
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                background: groupColor,
                border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                zIndex: -1, // To jest kluczowe! Grupa musi być pod nodami
                pointerEvents: 'none' // Żeby kliknięcie w tło grupy nie blokowało selekcji nodów w środku
                // Uwaga: ReactFlow ma specyficzne podejście do z-index, 
                // czasem lepiej użyć wbudowanego <Group> z React Flow, ale to nasza wersja custom.
            }}>
                 {/* Tytuł Grupy */}
                 <div 
                    style={{ 
                        padding: '10px', 
                        color: 'rgba(255,255,255,0.5)', 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        pointerEvents: 'all' // Tytuł można klikać/edytować
                    }}
                 >
                    <input 
                        className="nodrag"
                        value={currentLabel}
                        onChange={(e) => updateNodeData({ label: e.target.value })}
                        style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none' }}
                        spellCheck={false}
                    />
                 </div>
            </div>
        </>
      );
  }

  // --- 2. RENDEROWANIE KOMPAKTOWE (Małe klocki) ---
  if (def.compact) {
    return (
      <div style={{
          ...baseStyle,
          borderRadius: '20px',
          padding: '0 10px',
          minWidth: '80px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
      }}>
        <div style={{ position: 'absolute', left: '-8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {def.inputs.map((input, i) => {
                 let topOffset = 0;
                 if(def.inputs.length > 1) topOffset = (i - (def.inputs.length - 1)/2) * 14;
                 return (
                    <Handle key={input.id} type="target" position={Position.Left} id={input.id}
                        style={{ background: TYPE_COLORS[input.type], width: '16px', height: '16px', border: '2px solid #1a1a1a', borderRadius: '50%', position: 'absolute', left: 0, top: topOffset, transform: 'translate(0, -50%)' }}
                    />
                 )
            })}
        </div>
        <input 
            className="nodrag"
            value={currentLabel}
            onChange={(e) => updateNodeData({ label: e.target.value })}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: '12px', width: '60px', outline: 'none', cursor: 'text', letterSpacing: '0.5px' }}
        />
        <div style={{ position: 'absolute', right: '-8px' }}>
            {def.outputs.map((output) => (
                <Handle key={output.id} type="source" position={Position.Right} id={output.id}
                    style={{ background: TYPE_COLORS[output.type], width: '16px', height: '16px', border: '2px solid #1a1a1a', borderRadius: '50%', position: 'absolute', right: 0, top: 0, transform: 'translate(0, -50%)' }}
                />
            ))}
        </div>
      </div>
    );
  }

  // --- 3. RENDEROWANIE STANDARDOWE ---
  return (
    <div style={{ ...baseStyle, borderRadius: '8px', minWidth: '180px' }}>
      <div style={{ background: '#333', padding: '4px 8px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'center' }}>
        <input 
            className="nodrag"
            value={currentLabel}
            onChange={(e) => updateNodeData({ label: e.target.value })}
            spellCheck={false}
            autoComplete="off"
            style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: '13px', width: '100%', outline: 'none', cursor: 'text', letterSpacing: '0.5px' }}
            placeholder={def.label} 
        />
      </div>
      
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {def.inputs.map((input) => (
            <div key={input.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', minHeight: '20px', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Handle type="target" position={Position.Left} id={input.id} style={{ background: TYPE_COLORS[input.type], width: '16px', height: '16px', left: '-8px', border: '2px solid #1a1a1a', borderRadius: '50%', transition: 'transform 0.1s' }} />
                    <span style={{ fontSize: '11px', marginLeft: '10px', color: '#ccc' }}>{input.label}</span>
                </div>
            </div>
        ))}
        {def.controls && (
            <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {def.controls.type === 'float' && (
                    <>
                        <div className="nodrag" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <input type="range" min={currentMin} max={currentMax} step={currentStep} value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ flex: 1, cursor: 'pointer', accentColor: '#ff007a', height: '6px' }} />
                            <input type="number" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ background: '#111', border: '1px solid #444', color: '#aaa', fontSize: '9px', width: '40px', textAlign: 'center', borderRadius: '3px', padding: '2px', outline: 'none' }} />
                        </div>
                        <div className="nodrag" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MIN</span><input type="number" value={currentMin} onChange={(e) => updateNodeData({ min: parseFloat(e.target.value) })} style={{ background: '#111', border: '1px solid #444', color: '#aaa', fontSize: '9px', width: '30px', textAlign: 'center', borderRadius: '3px', padding: '2px', outline: 'none' }} /></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MAX</span><input type="number" value={currentMax} onChange={(e) => updateNodeData({ max: parseFloat(e.target.value) })} style={{ background: '#111', border: '1px solid #444', color: '#aaa', fontSize: '9px', width: '30px', textAlign: 'center', borderRadius: '3px', padding: '2px', outline: 'none' }} /></div>
                        </div>
                    </>
                )}
                {def.controls.type === 'color' && (
                    <div className="nodrag" style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="color" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ width: '100%', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                    </div>
                )}
            </div>
        )}
        {(def.inputs.length > 0 || def.controls) && def.outputs.length > 0 && (
            <div style={{ height: '1px', background: '#333', margin: '0 10px' }} />
        )}
        {def.outputs.map((output) => (
            <div key={output.id} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', minHeight: '20px', padding: '0 12px' }}>
                <span style={{ fontSize: '11px', marginRight: '10px', color: '#ccc', textAlign: 'right' }}>{output.label}</span>
                <Handle type="source" position={Position.Right} id={output.id} style={{ background: TYPE_COLORS[output.type], width: '16px', height: '16px', right: '-8px', border: '2px solid #1a1a1a', borderRadius: '50%', transition: 'transform 0.1s' }} />
            </div>
        ))}
      </div>
    </div>
  );
});