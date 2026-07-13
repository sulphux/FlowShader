import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import type { ShaderNodeDefinition } from '../core/types';
import { TYPE_COLORS } from '../core/theme';
import { MultiTypeIndicator } from './MultiTypeIndicator';
import { loadAudioFile, playAudio, stopAudio, isAudioPlaying } from '../core/audioManager';
import { computeSmartSplitPorts, SMART_SPLIT_TYPE_CYCLE } from '../core/smartSplitAdapter';
import { getRuntimeTimeSeconds } from '../core/runtimeClock';
import { compileNodeOutputToGLSL, type GraphNode } from '../core/compiler';
import { collectRuntimeResources, type ShaderRuntimeResources } from '../core/runtimeResources';
import { compileFeedbackPasses, type FeedbackPassDefinition } from '../core/feedbackPasses';
import ShaderPreview from './ShaderPreview';

export const ShaderNode = memo(({ id, data, selected }: NodeProps) => {
  const def = data.definition as ShaderNodeDefinition;
  const { setNodes, getNodes, getEdges } = useReactFlow();

  const [showSettings, setShowSettings] = useState(false);
  const [showFrameBufferPreview, setShowFrameBufferPreview] = useState(false);
  const [frameBufferPreview, setFrameBufferPreview] = useState<{
    shader: string;
    resources: ShaderRuntimeResources;
    passes: FeedbackPassDefinition[];
  } | null>(null);
  // Wymusza rerender po zmianie stanu odtwarzania audio (stan żyje w audioManager)
  const [, setAudioRefresh] = useState(0);
  const [impulseActive, setImpulseActive] = useState(def.id === 'impulse');
  const [impulseTiming, setImpulseTiming] = useState({
    interval: 1, width: 0.05,
    intervalDriven: false, widthDriven: false,
    intervalResolved: true, widthResolved: true,
  });

  useEffect(() => {
    if (def.id !== 'impulse') return;

    const readFloatInput = (handle: 'interval' | 'width', fallback: number) => {
      const edge = getEdges().find(candidate => candidate.target === id && candidate.targetHandle === handle);
      if (!edge) return { value: fallback, driven: false, resolved: true };
      const source = getNodes().find(candidate => candidate.id === edge.source);
      if (source?.data?.definition?.id === 'param_float') {
        const parsed = Number(source.data.value ?? source.data.definition.controls?.defaultValue);
        if (Number.isFinite(parsed)) return { value: parsed, driven: true, resolved: true };
      }
      // Arbitrary shader expressions cannot be evaluated cheaply in React;
      // keep the LED useful with the documented default timing and mark the
      // field as externally driven.
      return { value: fallback, driven: true, resolved: false };
    };

    const tick = () => {
      const intervalInput = readFloatInput('interval', 1);
      const widthInput = readFloatInput('width', 0.05);
      const interval = Math.max(intervalInput.value, 0.001);
      const width = widthInput.value;
      const elapsed = getRuntimeTimeSeconds();
      const active = (elapsed % interval) < interval * width;
      setImpulseActive(previous => previous === active ? previous : active);
      setImpulseTiming(previous => (
        previous.interval === intervalInput.value && previous.width === width &&
        previous.intervalDriven === intervalInput.driven && previous.widthDriven === widthInput.driven &&
        previous.intervalResolved === intervalInput.resolved && previous.widthResolved === widthInput.resolved
      ) ? previous : {
        interval: intervalInput.value,
        width,
        intervalDriven: intervalInput.driven,
        widthDriven: widthInput.driven,
        intervalResolved: intervalInput.resolved,
        widthResolved: widthInput.resolved,
      });
    };

    tick();
    const timer = window.setInterval(tick, 16);
    return () => window.clearInterval(timer);
  }, [def.id, getEdges, getNodes, id]);

  useEffect(() => {
    if (def.id !== 'feedback' || !showFrameBufferPreview) return;

    const updatePreview = () => {
      const safeNodes: GraphNode[] = getNodes().map(node => ({
        id: node.id,
        type: node.type || 'shaderNode',
        data: node.data,
      }));
      const edges = getEdges();
      const next = {
        shader: compileNodeOutputToGLSL(safeNodes, edges, id, 'rgb'),
        resources: collectRuntimeResources(safeNodes),
        passes: compileFeedbackPasses(safeNodes, edges),
      };
      setFrameBufferPreview(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };

    updatePreview();
    const timer = window.setInterval(updatePreview, 500);
    return () => window.clearInterval(timer);
  }, [def.id, getEdges, getNodes, id, showFrameBufferPreview]);

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
  const isMissing = def.id === '__missing__';
  const isUV = def.id === 'uv';
  const isFloatParam = def.controls?.type === 'float' && def.inputs.length === 0;
  const isCustomNode = Boolean('isCustom' in def && def.isCustom);
  const isCustomPort = def.id === 'custom_input' || def.id === 'custom_output';

  // Custom Input/Output: force a fixed type instead of relying on auto-detection
  // from whatever gets connected. Forced type wins over detectedType everywhere
  // it's read (extractCustomNodePorts, customNodeManager rehydration).
  const forcedType = data.forcedType as string | undefined;
  const forcePortType = (type: string | undefined) => {
    const portId = def.id === 'custom_input' ? 'out' : 'in';
    const label = 'Value';
    updateNodeData({
      forcedType: type,
      definition: def.id === 'custom_input'
        ? { ...def, outputs: [{ id: portId, type: type || data.detectedType || 'auto', label }] }
        : { ...def, inputs: [{ id: portId, type: type || data.detectedType || 'auto', label }] }
    });
  };

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
  
  const customStyle = isCustomNode ? {
    border: selected ? '2px solid #ff007a' : '2px solid #9c27b0',
    boxShadow: selected ? '0 0 15px rgba(255, 0, 122, 0.4)' : '0 4px 12px rgba(156, 39, 176, 0.4)',
  } : {};

  const baseStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: selected ? '1px solid #ff007a' : '1px solid #555',
    color: '#fff',
    fontFamily: 'sans-serif',
    boxShadow: selected ? '0 0 15px rgba(255, 0, 122, 0.4)' : '0 4px 8px rgba(0,0,0,0.5)',
    transition: 'all 0.1s',
    borderRadius: '6px',
    ...uvStyle,
    ...customStyle
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
  
  if (isMissing) {
      return (
        <div
          title={def.description}
          style={{
            background: '#2a1414', border: selected ? '2px solid #ff5252' : '1px dashed #ff5252',
            borderRadius: '8px', padding: '10px 14px', minWidth: '180px', fontFamily: 'sans-serif',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)', cursor: 'help',
          }}
        >
          <div style={{ color: '#ff5252', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>⚠ Missing node</div>
          <div style={{ color: '#eee', fontSize: '12px' }}>{currentLabel}</div>
          <div style={{ color: '#999', fontSize: '10px', marginTop: '4px', fontFamily: 'monospace' }}>{def.missingOriginalId}</div>
        </div>
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

  // --- SMUKŁE ADAPTERY (Split / Combine) ---
  // Wąski pionowy node z symbolem zamiast pełnej listy portów;
  // nazwa i opis w tooltipie (hover), porty podpisane przez title na handle'ach.
  const isSplitter = def.id.startsWith('split_') || def.id === 'smart_split';
  const isCombiner = def.id.startsWith('combine_') || def.id === 'smart_compose';

  if (isSplitter || isCombiner) {
    const mainType = isCombiner ? (def.outputs[0]?.type || 'auto') : (def.inputs[0]?.type || 'auto');
    const accent = TYPE_COLORS[mainType] || '#888';
    const badge = mainType === 'vec2' ? '2' : mainType === 'vec3' ? '3' : mainType === 'vec4' ? '4' : mainType === 'float' ? '1' : 'A';
    const portCount = Math.max(def.inputs.length, def.outputs.length, 1);
    const slimHeight = Math.max(44, portCount * 16 + 14);
    const canCycleType = def.id === 'smart_compose' || def.id === 'smart_split';
    const cycleComposeType = () => {
      const order: Array<'vec2' | 'vec3' | 'vec4'> = ['vec2', 'vec3', 'vec4'];
      const current = def.outputs[0]?.type as 'vec2' | 'vec3' | 'vec4';
      const next = order[(order.indexOf(current) + 1) % order.length];
      changeComposeType(next);
    };
    // Split (Auto): wymuszenie typu wejścia klikiem w badge (analogicznie do Combine).
    // Raz wymuszony typ nie jest już nadpisywany przez auto-detekcję z podłączonego
    // kabla — logika adaptacji w NodeEditor/graphRehydration działa tylko dopóki
    // typ jest 'auto', więc ustawienie konkretnego typu tutaj samo w sobie "blokuje" wybór.
    const cycleSplitType = () => {
      const current = def.inputs[0]?.type;
      const currentIndex = SMART_SPLIT_TYPE_CYCLE.indexOf(current as typeof SMART_SPLIT_TYPE_CYCLE[number]);
      const next = SMART_SPLIT_TYPE_CYCLE[(currentIndex + 1) % SMART_SPLIT_TYPE_CYCLE.length];
      const adapted = computeSmartSplitPorts(next);
      updateNodeData({
        forcedType: next,
        definition: { ...def, inputs: [{ id: 'in', label: adapted.inputLabel, type: next }], outputs: adapted.outputs }
      });
    };
    const cycleType = def.id === 'smart_split' ? cycleSplitType : cycleComposeType;

    const slimHandleStyle = (type: string, isAuto: boolean, isMultiType: boolean): React.CSSProperties => ({
      background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[type],
      width: '10px',
      height: '10px',
      border: '2px solid #1a1a1a',
      position: 'relative',
      top: 'auto',
      transform: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    });

    return (
      <div
        title={`${currentLabel}${def.description ? ` — ${def.description}` : ''}`}
        style={{
          ...baseStyle,
          width: '36px',
          height: `${slimHeight}px`,
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          position: 'relative',
          borderTop: `3px solid ${accent}`
        }}
      >
        {/* Wejścia (lewa krawędź) */}
        <div style={{ position: 'absolute', left: '-6px', top: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'flex-start' }}>
          {def.inputs.map((input, i) => {
            const isAuto = input.type === 'auto';
            const isMultiType = input.type.includes('|');
            return (
              <Handle
                key={`input-${input.id}-${i}`}
                type="target"
                position={Position.Left}
                id={input.id}
                title={input.label}
                className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                style={{ ...slimHandleStyle(input.type, isAuto, isMultiType), left: 0 }}
              >
                {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
              </Handle>
            );
          })}
        </div>

        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#eee', lineHeight: 1, userSelect: 'none' }}>
          {isSplitter ? '≺' : '≻'}
        </span>
        <span
          className={canCycleType ? 'nodrag' : undefined}
          onClick={canCycleType ? cycleType : undefined}
          title={canCycleType ? (isSplitter ? 'Click: force input type (float → vec2 → vec3 → vec4)' : 'Click: pick output type (vec2 → vec3 → vec4)') : undefined}
          style={{
            fontSize: '9px', fontWeight: 'bold', color: accent, lineHeight: 1, userSelect: 'none',
            cursor: canCycleType ? 'pointer' : 'default',
            border: canCycleType ? `1px solid ${accent}` : 'none',
            borderRadius: '3px', padding: canCycleType ? '1px 3px' : 0
          }}
        >
          {badge}
        </span>

        {/* Wyjścia (prawa krawędź) */}
        <div style={{ position: 'absolute', right: '-6px', top: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'flex-end' }}>
          {def.outputs.map((output, i) => {
            const isAuto = output.type === 'auto';
            const isMultiType = output.type.includes('|');
            return (
              <Handle
                key={`output-${output.id}-${i}`}
                type="source"
                position={Position.Right}
                id={output.id}
                title={output.label}
                className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                style={{ ...slimHandleStyle(output.type, isAuto, isMultiType), right: 0 }}
              >
                {isMultiType && <MultiTypeIndicator types={output.type} size={10} />}
              </Handle>
            );
          })}
        </div>
      </div>
    );
  }

  // --- FRAME BUFFER (opcjonalny podgląd zapamiętanego obrazu) ---
  if (def.id === 'feedback') {
    return (
      <div style={{ ...baseStyle, width: '210px', position: 'relative', overflow: 'visible' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS.vec3, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{
          padding: '5px 8px', background: '#222', borderBottom: '1px solid #333',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#eee', whiteSpace: 'nowrap' }}>FRAME BUFFER</span>
          <button
            type="button"
            className="nodrag"
            data-testid="frame-buffer-preview-toggle"
            aria-label={showFrameBufferPreview ? 'Hide buffer preview' : 'Show buffer preview'}
            onMouseDown={preventDrag}
            onClick={() => setShowFrameBufferPreview(open => !open)}
            style={{
              background: showFrameBufferPreview ? '#3a2740' : '#2b2b2b',
              border: `1px solid ${showFrameBufferPreview ? '#ff007a' : '#4a4a4a'}`,
              borderRadius: '4px', color: showFrameBufferPreview ? '#ff8fbd' : '#aaa',
              fontSize: '9px', padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {showFrameBufferPreview ? '▾ Preview' : '▸ Preview'}
          </button>
        </div>

        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            {def.inputs.map(input => (
              <div key={input.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  title={input.label}
                  style={{
                    background: TYPE_COLORS[input.type] || '#888', width: '10px', height: '10px',
                    left: '-15px', border: '2px solid #1a1a1a'
                  }}
                />
                <span style={{ fontSize: input.id === 'uv' ? '9px' : '10px', color: input.id === 'uv' ? '#888' : '#ccc', whiteSpace: 'nowrap' }}>
                  {input.label}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', height: '16px', position: 'relative' }}>
            <span style={{ fontSize: '9px', color: '#ccc', marginRight: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>Stored Image</span>
            <Handle
              type="source"
              position={Position.Right}
              id="rgb"
              title="Stored Image"
              style={{ background: TYPE_COLORS.vec3, width: '10px', height: '10px', right: '-15px', border: '2px solid #1a1a1a' }}
            />
          </div>
        </div>

        {showFrameBufferPreview && (
          <div
            data-testid="frame-buffer-preview-window"
            className="nodrag"
            style={{
              height: '118px', margin: '0 8px 8px', borderRadius: '5px', overflow: 'hidden',
              background: '#050505', border: '1px solid #3a3a3a', position: 'relative',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)'
            }}
            onMouseDown={preventDrag}
          >
            {frameBufferPreview ? (
              <ShaderPreview
                shaderCode={frameBufferPreview.shader}
                resources={frameBufferPreview.resources}
                feedbackPasses={frameBufferPreview.passes}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '9px' }}>
                Preparing preview…
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- TEXTURE (wgrany obraz) ---
  if (def.id === 'texture_2d') {
    const imageSrc = typeof currentValue === 'string' ? currentValue : '';
    const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          updateNodeData({ value: ev.target.result, label: file.name });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    return (
      <div style={{ ...baseStyle, width: '130px', position: 'relative' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS['vec3'], borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentLabel}>
          🖼️ {currentLabel}
        </div>

        <div className="nodrag" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <label style={{ cursor: 'pointer', width: '100%' }}>
            <div style={{
              width: '106px', height: '64px', borderRadius: '4px', border: '1px dashed #555',
              background: imageSrc ? `url(${imageSrc}) center/cover` : '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#666', fontSize: '10px'
            }}>
              {!imageSrc && 'Wgraj obraz…'}
            </div>
            <input type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 6px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
            <Handle type="target" position={Position.Left} id="uv" title="UV"
              style={{ background: TYPE_COLORS['vec2'], width: '10px', height: '10px', left: '-13px', border: '2px solid #1a1a1a' }} />
            <span style={{ fontSize: '10px', color: '#ccc' }}>UV</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
            <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>RGB</span>
            <Handle type="source" position={Position.Right} id="rgb" title="RGB"
              style={{ background: TYPE_COLORS['vec3'], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }} />
          </div>
        </div>
      </div>
    );
  }

  // --- AUDIO (wgrany dźwięk) ---
  if (def.id === 'audio_input') {
    const playing = isAudioPlaying();
    const hasFile = Boolean(data.audioLoaded);
    const onAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      file.arrayBuffer().then(buffer => loadAudioFile(buffer, file.name)).then(() => {
        // Dźwięk żyje tylko w pamięci (pliki audio są za duże na zapis w JSON);
        // w data trzymamy nazwę i flagę, żeby UI wiedziało, że plik jest wgrany.
        updateNodeData({ label: file.name, audioLoaded: true });
      });
      e.target.value = '';
    };
    const togglePlay = () => {
      if (playing) stopAudio(); else playAudio();
      setAudioRefresh(t => t + 1);
    };

    return (
      <div style={{ ...baseStyle, width: '150px', position: 'relative' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS['float'], borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '10px', fontWeight: 'bold', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentLabel}>
          🎵 {currentLabel}
        </div>

        <div className="nodrag" style={{ padding: '6px 8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <label style={{ cursor: 'pointer', flex: 1 }}>
            <div style={{ border: '1px dashed #555', borderRadius: '4px', padding: '4px', textAlign: 'center', color: '#888', fontSize: '10px', background: '#111' }}>
              {hasFile ? 'Zmień plik…' : 'Wgraj dźwięk…'}
            </div>
            <input type="file" accept="audio/*" onChange={onAudioFile} style={{ display: 'none' }} />
          </label>
          <button
            onClick={togglePlay}
            disabled={!hasFile}
            title={playing ? 'Pause' : 'Play'}
            style={{
              width: '26px', height: '26px', borderRadius: '50%', cursor: hasFile ? 'pointer' : 'not-allowed',
              background: playing ? '#ff007a' : '#333', color: '#fff', border: '1px solid #555',
              fontSize: '11px', opacity: hasFile ? 1 : 0.4
            }}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', padding: '2px 8px 8px 8px' }}>
          {def.outputs.map(output => (
            <div key={output.id} style={{ display: 'flex', alignItems: 'center', height: '14px', position: 'relative' }}>
              <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>{output.label}</span>
              <Handle type="source" position={Position.Right} id={output.id} title={output.label}
                style={{ background: TYPE_COLORS['float'], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- MINI EDYTOR KODU (Code GLSL) ---
  if (def.id === 'code_glsl') {
    const outType = def.outputs[0]?.type || 'float';
    const setOutType = (t: string) => {
      updateNodeData({ definition: { ...def, outputs: [{ id: 'out', label: 'Out', type: t }] } });
    };

    return (
      <div style={{ ...baseStyle, width: '220px', position: 'relative' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS[outType] || '#555', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px' }}>📝</span>
          <input
            className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off"
            style={{ background: 'transparent', border: 'none', color: '#eee', fontWeight: 'bold', fontSize: '12px', width: '100%', outline: 'none' }}
            onFocus={handleTitleFocus} onMouseDown={preventDrag}
          />
        </div>

        <textarea
          className="nodrag"
          value={currentValue ?? ''}
          onChange={(e) => updateNodeData({ value: e.target.value })}
          spellCheck={false}
          placeholder="np. sin(a * 6.28) + b"
          style={{
            width: '100%', boxSizing: 'border-box', height: '64px', resize: 'vertical',
            background: '#111', border: 'none', borderBottom: '1px solid #333',
            color: '#9cdcfe', fontFamily: 'monospace', fontSize: '11px',
            padding: '6px 8px', outline: 'none'
          }}
          onMouseDown={preventDrag}
        />

        <div className="nodrag" style={{ display: 'flex', gap: '4px', padding: '4px 8px', justifyContent: 'center', background: '#1d1d1d' }}>
          {['float', 'vec2', 'vec3', 'vec4'].map(t => (
            <button
              key={t}
              onClick={() => setOutType(t)}
              title={`Typ wyjścia: ${t}`}
              style={{
                fontSize: '9px', padding: '2px 4px', cursor: 'pointer',
                background: outType === t ? (TYPE_COLORS[t] || '#ff007a') : '#333',
                border: '1px solid #444', color: outType === t ? '#000' : '#fff',
                fontWeight: 'bold', borderRadius: '4px'
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 8px' }}>
            {def.inputs.map((input) => (
              <div key={input.id} style={{ display: 'flex', alignItems: 'center', height: '14px', position: 'relative' }}>
                <Handle
                  type="target" position={Position.Left} id={input.id}
                  style={{ background: TYPE_COLORS[input.type], width: '10px', height: '10px', left: '-13px', border: '2px solid #1a1a1a' }}
                />
                <span style={{ fontSize: '10px', color: '#ccc', fontFamily: 'monospace' }}>{input.id}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative', padding: '0 8px' }}>
            <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>Out</span>
            <Handle
              type="source" position={Position.Right} id="out"
              style={{ background: TYPE_COLORS[outType], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- IMPULSE (czytelny generator zdarzeń z diodą stanu) ---
  if (def.id === 'impulse') {
    const ledColor = impulseActive ? '#ffeb3b' : '#4b4618';
    const ledUsesFallback = !impulseTiming.intervalResolved || !impulseTiming.widthResolved;
    const valueLabel = (value: number, driven: boolean, resolved: boolean, suffix: string) => driven
      ? (resolved ? `input · ${value.toFixed(2)}${suffix}` : 'dynamic input')
      : `default · ${value.toFixed(2)}${suffix}`;

    return (
      <div style={{ ...baseStyle, width: '184px', position: 'relative', overflow: 'visible' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS.float, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{
          padding: '6px 9px', background: '#222', borderBottom: '1px solid #333',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#eee' }}>IMPULSE</span>
          <div title={`${impulseActive ? 'Pulse is HIGH (1.0)' : 'Pulse is LOW (0.0)'}${ledUsesFallback ? ' · LED preview uses default timing for a dynamic shader input' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '8px', color: impulseActive ? '#fff4a3' : '#777', letterSpacing: '0.8px' }}>PULSE</span>
            <span
              data-testid="impulse-led"
              data-active={impulseActive ? 'true' : 'false'}
              style={{
                width: '10px', height: '10px', borderRadius: '50%', display: 'block',
                background: ledColor, border: `1px solid ${impulseActive ? '#fff7a8' : '#625c24'}`,
                boxShadow: impulseActive ? '0 0 5px #ffeb3b, 0 0 11px rgba(255,235,59,0.75)' : 'inset 0 0 3px rgba(0,0,0,0.8)',
                transition: 'background 40ms, box-shadow 40ms, border-color 40ms'
              }}
            />
          </div>
        </div>

        <div style={{ padding: '8px 10px 9px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '25px' }}>
            <Handle type="target" position={Position.Left} id="interval" title="Seconds between pulses"
              style={{ background: TYPE_COLORS.float, width: '10px', height: '10px', left: '-15px', border: '2px solid #1a1a1a' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#ddd', fontWeight: 'bold' }}>Interval</div>
              <div style={{ fontSize: '8px', color: '#777' }}>seconds between pulses</div>
            </div>
            <span style={{ fontSize: '8px', color: '#999', fontFamily: 'monospace' }}>
              {valueLabel(impulseTiming.interval, impulseTiming.intervalDriven, impulseTiming.intervalResolved, 's')}
            </span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '25px' }}>
            <Handle type="target" position={Position.Left} id="width" title="Fraction of the interval for which Pulse stays at 1.0"
              style={{ background: TYPE_COLORS.float, width: '10px', height: '10px', left: '-15px', border: '2px solid #1a1a1a' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#ddd', fontWeight: 'bold' }}>Pulse Width</div>
              <div style={{ fontSize: '8px', color: '#777' }}>on-time fraction · 0–1</div>
            </div>
            <span style={{ fontSize: '8px', color: '#999', fontFamily: 'monospace' }}>
              {valueLabel(impulseTiming.width, impulseTiming.widthDriven, impulseTiming.widthResolved, '')}
            </span>
          </div>

          <div style={{ borderTop: '1px solid #2d2d2d', paddingTop: '7px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
              <span style={{ fontSize: '10px', color: impulseActive ? '#fff4a3' : '#aaa', marginRight: '6px', fontWeight: 'bold' }}>Pulse · 0/1</span>
              <Handle type="source" position={Position.Right} id="out" title="Pulse: 1.0 while active, otherwise 0.0"
                style={{ background: TYPE_COLORS.float, width: '10px', height: '10px', right: '-15px', border: '2px solid #1a1a1a' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (def.compact) {
    return (
      <div 
        title={def.description}
        style={{ ...baseStyle, borderRadius: '16px', padding: '0 12px', minWidth: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        {/* Left side - inputs with flexbox */}
        <div style={{ 
          position: 'absolute', 
          left: '-6px', 
          height: '100%',
          top: 0,
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-evenly',
          alignItems: 'flex-start'
        }}>
            {def.inputs.map((input, i) => {
                 const isAuto = input.type === 'auto';
                 const isMultiType = input.type.includes('|');
                 
                 return <Handle
                   key={`input-${input.id}-${i}`}
                   type="target"
                   position={Position.Left}
                   id={input.id}
                   title={input.label}
                   className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                   style={{
                     background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[input.type],
                     width: '10px',
                     height: '10px',
                     border: '2px solid #1a1a1a',
                     position: 'relative',
                     left: 0,
                     top: 'auto',
                     transform: 'none',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     overflow: 'hidden'
                   }}
                 >
                   {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
                 </Handle>
            })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isCustomNode && <span style={{ fontSize: '14px' }}>🔲</span>}
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{currentLabel}</span>
        </div>
        {/* Right side - outputs with flexbox */}
        <div style={{ 
          position: 'absolute', 
          right: '-6px', 
          height: '100%',
          top: 0,
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-evenly',
          alignItems: 'flex-end'
        }}>
            {def.outputs.map((output, i) => {
                const isAuto = output.type === 'auto';
                const isMultiType = output.type.includes('|');
                
                return <Handle
                  key={`output-${output.id}-${i}`}
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  title={output.label}
                  className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                  style={{
                    background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[output.type],
                    width: '10px',
                    height: '10px',
                    border: '2px solid #1a1a1a',
                    position: 'relative',
                    right: 0,
                    top: 'auto',
                    transform: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {isMultiType && <MultiTypeIndicator types={output.type} size={10} />}
                </Handle>
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
                     <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <div
                          onClick={() => updateNodeData({ value: Math.max(currentMin, parseFloat(currentValue) - currentStep).toFixed(2) })}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff007a'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                          style={{ cursor: 'pointer', color: '#666', fontSize: '11px', userSelect: 'none', padding: '4px 3px', lineHeight: 1, transition: 'color 0.15s' }}
                        >◀</div>
                        <input type="number" value={currentValue} onChange={(e) => updateNodeData({ value: e.target.value })} style={{ background: 'transparent', border: 'none', color: '#ff007a', fontSize: '16px', fontWeight: 'bold', width: dynamicWidth, minWidth: '40px', textAlign: 'center', outline: 'none', padding: 0, margin: 0 }} onMouseDown={preventDrag} />
                        <div
                          onClick={() => updateNodeData({ value: Math.min(currentMax, parseFloat(currentValue) + currentStep).toFixed(2) })}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff007a'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                          style={{ cursor: 'pointer', color: '#666', fontSize: '11px', userSelect: 'none', padding: '4px 3px', lineHeight: 1, transition: 'color 0.15s' }}
                        >▶</div>
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
    <div style={{ ...baseStyle, minWidth: '100px', position: 'relative' }}>
      {renderInfoIcon()}
      {isCustomNode && (
        <div style={{ 
          position: 'absolute', 
          top: '-10px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          background: '#9c27b0',
          color: '#fff',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '8px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(156, 39, 176, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          🔲 CUSTOM
        </div>
      )}
      <div style={{ height: '4px', background: headerColorBase, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
      <div style={{ padding: '4px 8px', background: '#222', borderBottom: '1px solid #333' }}>
        <input 
            className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" 
            style={{ background: 'transparent', border: '1px solid transparent', color: '#eee', fontWeight: 'bold', fontSize: '12px', width: '100%', outline: 'none', borderRadius: '4px' }} 
            onFocus={handleTitleFocus} onBlur={(e) => e.target.style.borderColor = 'transparent'} onMouseDown={preventDrag}
        />
      </div>
      
      <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {def.inputs.map((input) => {
                    const isAuto = input.type === 'auto';
                    const isMultiType = input.type.includes('|');
                    
                    return (
                      <div key={input.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          <Handle 
                            type="target" 
                            position={Position.Left} 
                            id={input.id} 
                            className={isAuto ? 'port-auto' : ''}
                            style={{ 
                              background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[input.type],
                              width: '10px', 
                              height: '10px', 
                              left: '-13px', 
                              border: '2px solid #1a1a1a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden'
                            }} 
                          >
                            {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
                          </Handle>
                          <span style={{ fontSize: '10px', color: '#ccc' }}>{input.label}</span>
                      </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {def.outputs.map((output) => {
                    const isAuto = output.type === 'auto';
                    const isMultiType = output.type.includes('|');
                    
                    return (
                      <div key={output.id} style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>{output.label}</span>
                          <Handle 
                            type="source" 
                            position={Position.Right} 
                            id={output.id} 
                            className={isAuto ? 'port-auto' : ''}
                            style={{ 
                              background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[output.type],
                              width: '10px', 
                              height: '10px', 
                              right: '-13px', 
                              border: '2px solid #1a1a1a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden'
                            }} 
                          >
                            {isMultiType && <MultiTypeIndicator types={output.type} size={10} />}
                          </Handle>
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
        {isCustomPort && (
            <div className="nodrag" style={{ padding: '2px 8px 6px 8px' }}>
                <div style={{ fontSize: '8px', color: '#666', marginBottom: '3px' }}>FORCE TYPE</div>
                <div style={{ display: 'flex', gap: '3px' }}>
                    {['float', 'vec2', 'vec3', 'vec4'].map(t => (
                        <button
                            key={t}
                            onClick={() => forcePortType(t)}
                            title={`Force this port to ${t}, ignoring what's connected`}
                            style={{
                                flex: 1, fontSize: '8px', padding: '2px 0', cursor: 'pointer',
                                background: forcedType === t ? (TYPE_COLORS[t] || '#ff007a') : '#333',
                                border: '1px solid #444', color: forcedType === t ? '#000' : '#fff',
                                fontWeight: 'bold', borderRadius: '3px'
                            }}
                        >
                            {t === 'float' ? '1' : t.slice(-1)}
                        </button>
                    ))}
                    {forcedType && (
                        <button
                            onClick={() => forcePortType(undefined)}
                            title="Clear forced type (go back to auto-detecting from the connection)"
                            style={{
                                flex: 1, fontSize: '8px', padding: '2px 0', cursor: 'pointer',
                                background: '#333', border: '1px solid #9c27b0', color: '#9c27b0',
                                fontWeight: 'bold', borderRadius: '3px'
                            }}
                        >
                            AUTO
                        </button>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
});
