import { memo, useCallback, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import type { ShaderNodeDefinition } from '../core/types';
import { TYPE_COLORS } from '../core/theme';

export const ShaderNode = memo(({ id, data, selected }: NodeProps) => {
  const def = data.definition as ShaderNodeDefinition;
  const { setNodes } = useReactFlow();
  
  const [showSettings, setShowSettings] = useState(false);

  const updateNodeData = useCallback((changes: Record<string, unknown>) => {
    setNodes((nds) => nds.map((node) => {
        if (node.id === id) {
            return { ...node, data: { ...node.data, ...changes } };
        }
        
        const isParam = def.id === 'param_float' || def.id === 'param_color';
        if (isParam && 'value' in changes) {
            const myLabel = data.label || def.label;
            const otherLabel = node.data.label || node.data.definition.label;
            
            if (otherLabel === myLabel && node.data.definition.id === def.id) {
                return { ...node, data: { ...node.data, value: changes.value } };
            }
        }

        return node;
    }));
  }, [id, setNodes, def.id, def.label, data.label]);

  const changeComposeType = (type: 'vec2' | 'vec3' | 'vec4') => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newInputs: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newOutput: any = { id: 'out', label: 'Vec3', type: 'vec3' };
      
      if(type === 'vec2') {
          newInputs = [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }];
          newOutput = { id: 'out', label: 'Vec2', type: 'vec2' };
      } else if (type === 'vec3') {
          newInputs = [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }, { id: 'z', label: 'Z', type: 'float' }];
          newOutput = { id: 'out', label: 'Vec3', type: 'vec3' };
      } else {
          newInputs = [{ id: 'x', label: 'X', type: 'float' }, { id: 'y', label: 'Y', type: 'float' }, { id: 'z', label: 'Z', type: 'float' }, { id: 'w', label: 'W', type: 'float' }];
          newOutput = { id: 'out', label: 'Vec4', type: 'vec4' };
      }

      updateNodeData({ 
          definition: { ...def, inputs: newInputs, outputs: [newOutput] } 
      });
  };

  const currentValue = data.value ?? def.controls?.defaultValue;
  const currentLabel = data.label ?? def.label;
  const currentMin = data.min ?? def.controls?.min ?? 0;
  const currentMax = data.max ?? def.controls?.max ?? 1;
  const currentStep = def.controls?.step ?? 0.01;

  const isNote = def.id === 'special_note';
  const isGroup = def.id === 'special_group';
  const isUV = def.id === 'uv';
  const isFloatParam = def.controls?.type === 'float' && def.inputs.length === 0;
  const isSmartCompose = def.id === 'smart_compose';

  let headerType = def.outputs[0]?.type || 'default';
  if (headerType === 'float' && def.inputs.length > 0) {
      const firstInputType = def.inputs[0].type;
      if (firstInputType.startsWith('vec')) {
          headerType = firstInputType;
      }
  }
  
  const headerColorBase = TYPE_COLORS[headerType] || '#555';
  
  const uvStyle = isUV ? { 
      boxShadow: selected 
          ? `0 0 15px rgba(255, 0, 122, 0.4), inset 0 4px 0 0 ${TYPE_COLORS['vec2']}` 
          : `0 4px 8px rgba(0,0,0,0.5), inset 0 4px 0 0 ${TYPE_COLORS['vec2']}` 
  } : {};

  const baseStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    color: '#fff',
    fontFamily: 'sans-serif',
    boxShadow: selected ? '0 0 15px rgba(255, 0, 122, 0.4)' : '0 4px 8px rgba(0,0,0,0.5)',
    transition: 'all 0.1s',
    borderRadius: '6px',
    ...uvStyle
  };

  const handleTitleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#555';
      const target = e.target;
      setTimeout(() => target.select(), 10);
  };

  const preventDrag = (e: React.MouseEvent) => { e.stopPropagation(); };

  const renderInfoIcon = () => {
      if (!def.description) return null;
      return (
        <div 
            title={def.description}
            style={{ 
                position: 'absolute', top: '-8px', right: '-8px', 
                background: '#444', color: '#ccc', fontSize: '10px', 
                width: '14px', height: '14px', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'help', border: '1px solid #555', zIndex: 10
            }}
        >
            i
        </div>
      );
  };

  if (isNote) {
      return (
        <>
            <NodeResizer minWidth={160} minHeight={100} isVisible={selected} lineStyle={{ border: '1px solid #ff007a' }} />
            <div style={{ ...baseStyle, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#4e342e', border: selected ? '1px solid #ff007a' : '1px solid #6d4c41', overflow: 'hidden' }}>
                <div style={{ padding: '4px', background: 'rgba(0,0,0,0.2)' }}>
                    <input className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" placeholder="Title" onFocus={handleTitleFocus} onMouseDown={preventDrag} />
                </div>
                <textarea className="nodrag" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} spellCheck={false} style={{ flex: 1, width: '100%', resize: 'none', background: 'transparent', border: 'none', color: '#ffe082', fontFamily: 'monospace', fontSize: '12px', padding: '8px', outline: 'none' }} onMouseDown={preventDrag} />
            </div>
        </>
      );
  }
  
  if (isGroup) {
      const groupColor = data.value || 'rgba(255, 255, 255, 0.05)';
      return (
        <>
            <NodeResizer minWidth={200} minHeight={150} isVisible={selected} lineStyle={{ border: '1px solid rgba(255,255,255,0.3)' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: groupColor, border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', zIndex: -1, pointerEvents: 'none' }}>
                 <div className="nodrag" style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'all' }}>
                    <input className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} style={{ fontSize: '24px', fontWeight: 'bold', width: '80%' }} spellCheck={false} onFocus={handleTitleFocus} onMouseDown={preventDrag} />
                    <input type="color" value={data.value || '#ffffff'} onChange={(e) => { const hex = e.target.value; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); updateNodeData({ value: `rgba(${r}, ${g}, ${b}, 0.15)` }); }} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5 }} />
                 </div>
            </div>
        </>
      );
  }

  if (def.compact) {
    return (
      <div 
        title={def.description}
        style={{ ...baseStyle, borderRadius: '16px', padding: '0 12px', minWidth: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        <div style={{ position: 'absolute', left: '-6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {def.inputs.map((input, i) => {
                 let topOffset = 0;
                 if(def.inputs.length > 1) topOffset = (i - (def.inputs.length - 1)/2) * 12;
                 const isAuto = input.type === 'auto';
                 return <Handle 
                   key={input.id} 
                   type="target" 
                   position={Position.Left} 
                   id={input.id} 
                   className={isAuto ? 'port-auto' : ''}
                   style={{ 
                     background: isAuto ? undefined : TYPE_COLORS[input.type], 
                     width: '10px', 
                     height: '10px', 
                     border: '2px solid #1a1a1a', 
                     left: 0, 
                     top: topOffset, 
                     transform: 'translate(0, -50%)' 
                   }} 
                 />
            })}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{currentLabel}</span>
        <div style={{ position: 'absolute', right: '-6px' }}>
            {def.outputs.map((output) => {
                const isAuto = output.type === 'auto';
                return <Handle 
                  key={output.id} 
                  type="source" 
                  position={Position.Right} 
                  id={output.id} 
                  className={isAuto ? 'port-auto' : ''}
                  style={{ 
                    background: isAuto ? undefined : TYPE_COLORS[output.type], 
                    width: '10px', 
                    height: '10px', 
                    border: '2px solid #1a1a1a', 
                    right: 0, 
                    top: 0, 
                    transform: 'translate(0, -50%)' 
                  }} 
                />
            })}
        </div>
      </div>
    );
  }

  if (isFloatParam) {
    const valString = currentValue.toString();
    const dynamicWidth = `${Math.max(3, valString.length) + 2}ch`;

    return (
        <div style={{ ...baseStyle, minWidth: 'auto' }}> 
             {renderInfoIcon()}
             <div style={{ height: '4px', background: headerColorBase, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
             
             <div style={{ padding: '2px 8px', background: '#222', borderBottom: '1px solid #333' }}>
                <input className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" style={{ background: 'transparent', border: 'none', color: '#ccc', fontWeight: 'bold', fontSize: '11px', width: '100%', outline: 'none' }} placeholder={def.label} onFocus={handleTitleFocus} onMouseDown={preventDrag} />
             </div>

             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <div onClick={() => setShowSettings(!showSettings)} style={{ cursor: 'pointer', fontSize: '12px', color: showSettings ? '#ff007a' : '#666', padding: '2px', lineHeight: 1 }}>⚙️</div>
                     <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div onClick={() => updateNodeData({ value: Math.max(currentMin, parseFloat(currentValue) - currentStep).toFixed(2) })} style={{ cursor: 'pointer', color: '#666', fontSize: '10px', userSelect: 'none' }}>◀</div>
                        <input type="number" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ background: 'transparent', border: 'none', color: '#ff007a', fontSize: '16px', fontWeight: 'bold', width: dynamicWidth, minWidth: '40px', textAlign: 'center', outline: 'none', padding: 0, margin: 0 }} onMouseDown={preventDrag} />
                        <div onClick={() => updateNodeData({ value: Math.min(currentMax, parseFloat(currentValue) + currentStep).toFixed(2) })} style={{ cursor: 'pointer', color: '#666', fontSize: '10px', userSelect: 'none' }}>▶</div>
                     </div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#aaa', marginRight: '6px' }}>Val</span>
                    <Handle type="source" position={Position.Right} id="out" style={{ background: TYPE_COLORS['float'], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }} />
                 </div>
             </div>

             {showSettings && (
                 <div className="nodrag" style={{ margin: '0 8px 8px 8px', background: '#222', padding: '6px', borderRadius: '4px', borderTop: '1px solid #333' }}>
                    <input type="range" min={currentMin} max={currentMax} step={currentStep} value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ width: '100%', cursor: 'pointer', accentColor: '#ff007a', height: '6px' }} onMouseDown={preventDrag} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MIN</span><input type="number" value={currentMin} onChange={(e) => updateNodeData({ min: parseFloat(e.target.value) })} style={{ background: '#111', border: 'none', color: '#aaa', fontSize: '9px', width: '25px', textAlign: 'center' }} onMouseDown={preventDrag} /></div>
                        <div style={{ display: 'flex', gap: '2px' }}><span style={{ fontSize: '8px', color: '#666' }}>MAX</span><input type="number" value={currentMax} onChange={(e) => updateNodeData({ max: parseFloat(e.target.value) })} style={{ background: '#111', border: 'none', color: '#aaa', fontSize: '9px', width: '25px', textAlign: 'center' }} onMouseDown={preventDrag} /></div>
                    </div>
                 </div>
             )}
        </div>
    );
  }

  return (
    <div style={{ ...baseStyle, minWidth: '100px' }}>
      {renderInfoIcon()}
      <div style={{ height: '4px', background: headerColorBase, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
      <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333' }}>
        <input 
            className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" 
            style={{ background: 'transparent', border: '1px solid transparent', color: '#eee', fontWeight: 'bold', fontSize: '12px', width: '100%', outline: 'none', borderRadius: '4px' }} 
            onFocus={handleTitleFocus} onBlur={(e) => e.target.style.borderColor = 'transparent'} onMouseDown={preventDrag}
        />
      </div>
      
      {isSmartCompose && (
            <div className="nodrag" style={{ display: 'flex', gap: '4px', padding: '4px 8px', justifyContent: 'center', background: '#222' }}>
                {['vec2', 'vec3', 'vec4'].map(t => (
                    <button 
                        key={t}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onClick={() => changeComposeType(t as any)}
                        style={{ 
                            fontSize: '9px', padding: '2px 4px', cursor: 'pointer',
                            background: def.outputs[0].type === t ? '#ff007a' : '#333',
                            border: '1px solid #444', color: '#fff', borderRadius: '4px'
                        }}
                    >
                        {t.toUpperCase()}
                    </button>
                ))}
            </div>
      )}

      <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {def.inputs.map((input) => {
                    const isAuto = input.type === 'auto';
                    return (
                      <div key={input.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          <Handle 
                            type="target" 
                            position={Position.Left} 
                            id={input.id} 
                            className={isAuto ? 'port-auto' : ''}
                            style={{ 
                              background: isAuto ? undefined : TYPE_COLORS[input.type], 
                              width: '10px', 
                              height: '10px', 
                              left: '-13px', 
                              border: '2px solid #1a1a1a' 
                            }} 
                          />
                          <span style={{ fontSize: '10px', color: '#ccc' }}>{input.label}</span>
                      </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {def.outputs.map((output) => {
                    const isAuto = output.type === 'auto';
                    return (
                      <div key={output.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>{output.label}</span>
                          <Handle 
                            type="source" 
                            position={Position.Right} 
                            id={output.id} 
                            className={isAuto ? 'port-auto' : ''}
                            style={{ 
                              background: isAuto ? undefined : TYPE_COLORS[output.type], 
                              width: '10px', 
                              height: '10px', 
                              right: '-13px', 
                              border: '2px solid #1a1a1a' 
                            }} 
                          />
                      </div>
                    )
                })}
            </div>
        </div>
        {def.controls && !isFloatParam && (
            <div style={{ padding: '4px 8px', marginTop: '4px' }}>
                {def.controls.type === 'color' && (
                    <div className="nodrag"><input type="color" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ width: '100%', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }} onMouseDown={preventDrag} /></div>
                )}
            </div>
        )}
      </div>
    </div>
  );
});