import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import type { ShaderNodeDefinition } from '../core/types';
import { TYPE_COLORS } from '../core/theme';
import { MultiTypeIndicator } from './MultiTypeIndicator';
import { loadAudioFile, playAudio, stopAudio, isAudioPlaying } from '../core/audioManager';
import { computeSmartSplitPorts, SMART_SPLIT_TYPE_CYCLE } from '../core/smartSplitAdapter';
import { getRuntimeTimeSeconds } from '../core/runtimeClock';
import { isImpulsePulseActive, resolveImpulseTiming } from '../core/impulseTiming';
import { formatEditableFloat, parseEditableFloat, stepFloatValue } from '../core/floatEditing';
import { compileNodeOutputToGLSL, type GraphNode } from '../core/compiler';
import { loadCustomNodes } from '../core/customNodeManager';
import { collectRuntimeResources, type ShaderRuntimeResources } from '../core/runtimeResources';
import { compileFeedbackPasses, type FeedbackPassDefinition } from '../core/feedbackPasses';
import ShaderPreview from './ShaderPreview';
import { resolveFrameBufferMode, type FrameBufferMode } from '../core/frameBufferMode';
import { computeSmartComposePorts, inferCodeExpressionType } from '../core/dynamicPortSystem';
import {
  CODE_BLOCK_TYPES,
  codeBlockCallableName,
  formatCodeBlockSignature,
  isCodeBlockCallableNameAvailable,
  sanitizeCodePortId,
} from '../core/codeBlock';
import {
  clampLoopIterations,
  isCompatibleLoopStep,
  LOOP_DEFAULT_ITERATIONS,
  LOOP_MAX_ITERATIONS,
  loopStateType,
} from '../core/loopNode';
import { useI18n } from '../core/i18n';
import {
  inlinePortHandleId,
  isVectorType,
  parseInlinePortHandle,
  vectorComponents,
  type InlinePortDirection,
} from '../core/inlinePortAdapters';
import InlinePortContextMenu from './InlinePortContextMenu';

export const ShaderNode = memo(({ id, data, selected }: NodeProps) => {
  const { text } = useI18n();
  const def = data.definition as ShaderNodeDefinition;
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const [showSettings, setShowSettings] = useState(false);
  const [inlinePortMenu, setInlinePortMenu] = useState<{
    x: number;
    y: number;
    direction: InlinePortDirection;
    portId: string;
    portLabel: string;
    portType: 'vec2' | 'vec3' | 'vec4';
  } | null>(null);
  const [floatDraft, setFloatDraft] = useState(() => String(data.value ?? def.controls?.defaultValue ?? 0));
  const [floatEditing, setFloatEditing] = useState(false);
  const skipFloatCommitRef = useRef(false);
  const [showFrameBufferPreview, setShowFrameBufferPreview] = useState(false);
  const [sampleOffsetDrafts, setSampleOffsetDrafts] = useState(() => ({
    x: String(data.offsetX ?? 0),
    y: String(data.offsetY ?? 0),
  }));
  const [loopIterationDraft, setLoopIterationDraft] = useState(() =>
    String(data.iterations ?? LOOP_DEFAULT_ITERATIONS));
  const [, setCustomLibraryVersion] = useState(0);
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

    const tick = () => {
      const nextTiming = resolveImpulseTiming(id, getNodes(), getEdges());
      const elapsed = getRuntimeTimeSeconds();
      const active = isImpulsePulseActive(elapsed, nextTiming.interval, nextTiming.width);
      setImpulseActive(previous => previous === active ? previous : active);
      setImpulseTiming(previous => (
        previous.interval === nextTiming.interval && previous.width === nextTiming.width &&
        previous.intervalDriven === nextTiming.intervalDriven && previous.widthDriven === nextTiming.widthDriven &&
        previous.intervalResolved === nextTiming.intervalResolved && previous.widthResolved === nextTiming.widthResolved
      ) ? previous : nextTiming);
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

  useEffect(() => {
    if (def.id !== 'loop_iterate') return;
    const refreshSteps = () => {
      setCustomLibraryVersion(version => version + 1);
      const stepId = String(data.loopStepId ?? '');
      const step = loadCustomNodes().find(candidate => candidate.id === stepId && isCompatibleLoopStep(candidate));
      if (!step) return;
      const nextType = loopStateType(step);
      if (def.inputs[0]?.type === nextType && def.outputs[0]?.type === nextType) return;
      setNodes(current => current.map(node => node.id === id ? {
        ...node,
        data: {
          ...node.data,
          definition: {
            ...node.data.definition,
            inputs: [{ id: 'initial', label: 'Initial State', type: nextType }],
            outputs: [{ id: 'result', label: 'Final State', type: nextType }],
          },
        },
      } : node));
    };
    window.addEventListener('customNodesUpdated', refreshSteps);
    return () => window.removeEventListener('customNodesUpdated', refreshSteps);
  }, [data.loopStepId, def.id, def.inputs, def.outputs, id, setNodes]);

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

  const expandedInlineInputs = new Set<string>(data.inlinePortExpansion?.inputs || []);
  const expandedInlineOutputs = new Set<string>(data.inlinePortExpansion?.outputs || []);
  const isInlineExpanded = (direction: InlinePortDirection, portId: string) =>
    (direction === 'input' ? expandedInlineInputs : expandedInlineOutputs).has(portId);
  const hasInlineComponentEdges = (direction: InlinePortDirection, portId: string) =>
    getEdges().some(edge => {
      const handle = direction === 'input' ? edge.targetHandle : edge.sourceHandle;
      const parsed = parseInlinePortHandle(handle);
      return parsed?.direction === direction && parsed.portId === portId
        && (direction === 'input' ? edge.target === id : edge.source === id);
    });
  const hasParentPortEdge = (direction: InlinePortDirection, portId: string) =>
    getEdges().some(edge => direction === 'input'
      ? edge.target === id && edge.targetHandle === portId
      : edge.source === id && edge.sourceHandle === portId);
  const showParentPort = (direction: InlinePortDirection, portId: string) =>
    !isInlineExpanded(direction, portId) || hasParentPortEdge(direction, portId);
  const toggleInlinePort = (direction: InlinePortDirection, portId: string) => {
    if (isInlineExpanded(direction, portId) && hasInlineComponentEdges(direction, portId)) return;
    setNodes(nodes => nodes.map(node => {
      if (node.id !== id) return node;
      const current = node.data.inlinePortExpansion || {};
      const key = direction === 'input' ? 'inputs' : 'outputs';
      const ports = new Set<string>(current[key] || []);
      if (ports.has(portId)) ports.delete(portId);
      else ports.add(portId);
      return {
        ...node,
        data: {
          ...node.data,
          inlinePortExpansion: { ...current, [key]: [...ports] },
        },
      };
    }));
  };

  const inlineToggle = (direction: InlinePortDirection, port: { id: string; label: string; type: string }) => {
    if (!isVectorType(port.type)) return null;
    const expanded = isInlineExpanded(direction, port.id);
    const collapseBlocked = expanded && hasInlineComponentEdges(direction, port.id);
    return (
      <button
        type="button"
        className="nodrag"
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${port.label} ${port.type} components`}
        disabled={collapseBlocked}
        title={text(
          `${expanded ? 'Collapse' : 'Expand'} ${port.type} components inside this node`,
          `${expanded ? 'Zwiń' : 'Rozwiń'} składowe ${port.type} wewnątrz noda`,
        )}
        onClick={(event) => { event.stopPropagation(); toggleInlinePort(direction, port.id); }}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          border: 0, background: 'transparent', color: collapseBlocked ? '#666' : TYPE_COLORS[port.type], cursor: collapseBlocked ? 'not-allowed' : 'pointer',
          fontSize: '9px', lineHeight: 1, padding: '1px 2px', fontWeight: 'bold',
        }}
      >
        {expanded ? '▾' : direction === 'input' ? '◂' : '▸'}
      </button>
    );
  };

  const changeComposeType = (type: 'vec2' | 'vec3' | 'vec4') => {
      const ports = computeSmartComposePorts(type);
      updateNodeData({
          forcedType: type,
          definition: { ...def, inputs: ports.inputs, outputs: ports.outputs },
      });
  };

  const currentValue = data.value ?? def.controls?.defaultValue;
  const currentLabel = data.label ?? def.label;
  const currentMin = data.min ?? def.controls?.min ?? 0;
  const currentMax = data.max ?? def.controls?.max ?? 1;
  const configuredStep = parseEditableFloat(data.step ?? def.controls?.step) ?? 0.01;
  const currentStep = configuredStep > 0 ? configuredStep : 0.01;

  const isNote = def.id === 'special_note';
  const isGroup = def.id === 'special_group';
  const isMissing = def.id === '__missing__';
  const isUV = def.id === 'uv';
  const isFloatParam = def.controls?.type === 'float' && def.inputs.length === 0;
  const isCustomNode = Boolean('isCustom' in def && def.isCustom);
  const isCustomPort = def.id === 'custom_input' || def.id === 'custom_output';
  const displayedFloatValue = floatEditing ? floatDraft : String(currentValue);
  const frameBufferMode: FrameBufferMode = def.id === 'feedback'
    ? resolveFrameBufferMode({ id, data }, getEdges())
    : 'snapshot';

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
  const stopEditorKeyPropagation = (event: React.KeyboardEvent | React.SyntheticEvent) => {
    // React Flow has canvas-level keyboard handlers. Editors must receive
    // punctuation produced with Shift (notably `?` = Shift+/) unchanged.
    event.stopPropagation();
  };

  const commitSampleOffset = (axis: 'x' | 'y') => {
    const parsed = parseEditableFloat(sampleOffsetDrafts[axis]);
    const value = parsed ?? Number(data[axis === 'x' ? 'offsetX' : 'offsetY'] ?? 0);
    const formatted = formatEditableFloat(value);
    setSampleOffsetDrafts(previous => ({ ...previous, [axis]: formatted }));
    updateNodeData({ [axis === 'x' ? 'offsetX' : 'offsetY']: value });
  };

  const commitFloatDraft = (draft = floatDraft) => {
    const parsed = parseEditableFloat(draft);
    if (parsed === null) {
      setFloatDraft(String(currentValue));
      return;
    }
    const formatted = formatEditableFloat(parsed);
    setFloatDraft(formatted);
    updateNodeData({ value: formatted });
  };

  const nudgeFloat = (direction: -1 | 1, multiplier = 1) => {
    const next = stepFloatValue(
      parseEditableFloat(displayedFloatValue) ?? currentValue,
      currentStep,
      direction,
      parseEditableFloat(currentMin) ?? Number.NEGATIVE_INFINITY,
      parseEditableFloat(currentMax) ?? Number.POSITIVE_INFINITY,
      multiplier,
    );
    const formatted = formatEditableFloat(next);
    setFloatDraft(formatted);
    updateNodeData({ value: formatted });
  };

  const handleFloatKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFloatDraft();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      skipFloatCommitRef.current = true;
      setFloatDraft(String(currentValue));
      event.currentTarget.blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      nudgeFloat(event.key === 'ArrowUp' ? 1 : -1, multiplier);
    }
  };

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
    const slimInputs = def.inputs.flatMap(input => [
      ...(showParentPort('input', input.id) ? [{ ...input, parentId: input.id, parentLabel: input.label, parentType: input.type }] : []),
      ...(isInlineExpanded('input', input.id)
        ? vectorComponents(input.type).map(component => ({
            id: inlinePortHandleId('input', input.id, component),
            label: `${input.label}.${component.toUpperCase()}`, type: 'float',
            parentId: input.id, parentLabel: input.label, parentType: input.type,
          }))
        : []),
    ]);
    const slimOutputs = def.outputs.flatMap(output => [
      ...(showParentPort('output', output.id) ? [{ ...output, parentId: output.id, parentLabel: output.label, parentType: output.type }] : []),
      ...(isInlineExpanded('output', output.id)
        ? vectorComponents(output.type).map(component => ({
            id: inlinePortHandleId('output', output.id, component),
            label: `${output.label}.${component.toUpperCase()}`, type: 'float',
            parentId: output.id, parentLabel: output.label, parentType: output.type,
          }))
        : []),
    ]);
    const portCount = Math.max(slimInputs.length, slimOutputs.length, 1);
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
          width: '76px',
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
          {slimInputs.map((input, i) => {
            const isAuto = input.type === 'auto';
            const isMultiType = input.type.includes('|');
            return (
              <div key={`input-${input.id}-${i}`} data-port-label={input.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '14px' }}>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  title={`${input.label} · ${input.type}`}
                  onContextMenu={(event) => {
                    if (!isVectorType(input.parentType)) return;
                    event.preventDefault(); event.stopPropagation();
                    setInlinePortMenu({ x: event.clientX, y: event.clientY, direction: 'input', portId: input.parentId, portLabel: input.parentLabel, portType: input.parentType });
                  }}
                  className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                  style={{ ...slimHandleStyle(input.type, isAuto, isMultiType), left: 0, flex: '0 0 auto' }}
                >
                  {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
                </Handle>
                <span style={{ fontSize: '8px', color: isAuto ? TYPE_COLORS.auto : '#aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{input.label}</span>
              </div>
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
          {slimOutputs.map((output, i) => {
            const isAuto = output.type === 'auto';
            const isMultiType = output.type.includes('|');
            return (
              <div key={`output-${output.id}-${i}`} data-port-label={output.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', height: '14px' }}>
                <span style={{ fontSize: '8px', color: isAuto ? TYPE_COLORS.auto : '#aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{output.label}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  title={`${output.label} · ${output.type}`}
                  onContextMenu={(event) => {
                    if (!isVectorType(output.parentType)) return;
                    event.preventDefault(); event.stopPropagation();
                    setInlinePortMenu({ x: event.clientX, y: event.clientY, direction: 'output', portId: output.parentId, portLabel: output.parentLabel, portType: output.parentType });
                  }}
                  className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                  style={{ ...slimHandleStyle(output.type, isAuto, isMultiType), right: 0, flex: '0 0 auto' }}
                >
                  {isMultiType && <MultiTypeIndicator types={output.type} size={10} />}
                </Handle>
              </div>
            );
          })}
        </div>
        {inlinePortMenu && (
          <InlinePortContextMenu
            {...inlinePortMenu}
            expanded={isInlineExpanded(inlinePortMenu.direction, inlinePortMenu.portId)}
            canCollapse={!hasInlineComponentEdges(inlinePortMenu.direction, inlinePortMenu.portId)}
            onToggle={() => toggleInlinePort(inlinePortMenu.direction, inlinePortMenu.portId)}
            onClose={() => setInlinePortMenu(null)}
          />
        )}
      </div>
    );
  }

  // --- FRAME BUFFER (opcjonalny podgląd zapamiętanego obrazu) ---
  if (def.id === 'feedback') {
    return (
      <div style={{ ...baseStyle, width: '230px', position: 'relative', overflow: 'visible' }}>
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

        <div
          className="nodrag"
          role="group"
          aria-label="Frame Buffer mode"
          data-testid="frame-buffer-mode-switch"
          onMouseDown={preventDrag}
          style={{ display: 'flex', gap: '3px', padding: '7px 8px 0' }}
        >
          {([
            ['snapshot', 'SNAPSHOT', 'Capture once per event'],
            ['last-frame', 'LAST FRAME', 'One completed frame behind'],
          ] as const).map(([mode, label, title]) => {
            const active = frameBufferMode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-testid={`frame-buffer-mode-${mode}`}
                aria-pressed={active}
                title={title}
                onMouseDown={preventDrag}
                onClick={() => updateNodeData({ captureMode: mode })}
                style={{
                  flex: 1, background: active ? '#263a42' : '#242424',
                  border: `1px solid ${active ? '#29d9ff' : '#404040'}`,
                  borderRadius: '4px', color: active ? '#8cecff' : '#777',
                  fontSize: '8px', fontWeight: 700, padding: '4px 3px', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '4px 9px 0', color: '#777', fontSize: '8px', lineHeight: 1.25 }}>
          {frameBufferMode === 'snapshot'
            ? 'Stores once when Snapshot fires.'
            : 'Stores automatically; output is exactly 1 frame old.'}
        </div>

        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            {def.inputs.map(input => {
              const isMultiType = input.type.includes('|');
              return (
                <div key={input.id} style={{
                  display: 'flex', alignItems: 'center', height: '16px', position: 'relative',
                  opacity: input.id === 'impulse' && frameBufferMode === 'last-frame' ? 0.35 : 1,
                }}>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input.id}
                    title={input.id === 'impulse'
                      ? (frameBufferMode === 'snapshot'
                        ? 'Snapshot: manual signals capture on 0 → 1; Impulse connections latch every interval boundary'
                        : 'Snapshot is ignored in LAST FRAME mode')
                      : input.label}
                    style={{
                      background: isMultiType ? 'transparent' : (TYPE_COLORS[input.type] || '#888'), width: '10px', height: '10px',
                      left: '-15px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                    }}
                  >
                    {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
                  </Handle>
                  <span style={{ fontSize: input.id === 'uv' ? '9px' : '10px', color: input.id === 'uv' ? '#888' : '#ccc', whiteSpace: 'nowrap' }}>
                    {input.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-start' }}>
            {def.outputs.map(output => (
              <div key={output.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '16px', position: 'relative' }}>
                <span style={{ fontSize: '9px', color: output.type === 'buffer2d' ? '#68d6cc' : '#ccc', marginRight: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {output.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  title={output.label}
                  style={{ background: TYPE_COLORS[output.type] || '#888', width: '10px', height: '10px', right: '-15px', border: '2px solid #1a1a1a' }}
                />
              </div>
            ))}
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

  // --- SAMPLE BUFFER (wielokrotne próbkowanie jednego Frame Buffera) ---
  if (def.id === 'sample_buffer') {
    const sampleWrap = data.sampleWrap === 'clamp' ? 'clamp' : 'repeat';
    const renderOffsetInput = (axis: 'x' | 'y', inputId: 'offsetX' | 'offsetY') => (
      <div style={{ display: 'flex', alignItems: 'center', height: '22px', position: 'relative', gap: '6px' }}>
        <Handle
          type="target"
          position={Position.Left}
          id={inputId}
          title={`Optional connected Offset ${axis.toUpperCase()} overrides the inline value`}
          style={{ background: TYPE_COLORS.float, width: '10px', height: '10px', left: '-15px', border: '2px solid #1a1a1a' }}
        />
        <span style={{ width: '62px', fontSize: '9px', color: '#bbb' }}>Offset {axis.toUpperCase()}</span>
        <input
          className="nodrag"
          data-testid={`sample-buffer-offset-${axis}`}
          aria-label={`Offset ${axis.toUpperCase()} in pixels`}
          value={sampleOffsetDrafts[axis]}
          inputMode="decimal"
          onMouseDown={preventDrag}
          onChange={event => setSampleOffsetDrafts(previous => ({ ...previous, [axis]: event.target.value }))}
          onBlur={() => commitSampleOffset(axis)}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              commitSampleOffset(axis);
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              const saved = String(data[inputId] ?? 0);
              setSampleOffsetDrafts(previous => ({ ...previous, [axis]: saved }));
              event.currentTarget.blur();
            }
          }}
          style={{
            width: '54px', height: '19px', boxSizing: 'border-box', background: '#111', color: '#eee',
            border: '1px solid #444', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px',
            textAlign: 'right', padding: '1px 4px', outline: 'none'
          }}
        />
        <span style={{ fontSize: '8px', color: '#666' }}>px</span>
      </div>
    );

    return (
      <div style={{ ...baseStyle, width: '230px', position: 'relative', overflow: 'visible' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS.buffer2d, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '5px 8px', background: '#222', borderBottom: '1px solid #333', fontSize: '11px', fontWeight: 'bold', color: '#eee' }}>
          SAMPLE BUFFER
        </div>

        <div className="nodrag" style={{ display: 'flex', gap: '3px', padding: '7px 9px 2px' }} onMouseDown={preventDrag}>
          {(['repeat', 'clamp'] as const).map(mode => {
            const active = sampleWrap === mode;
            return (
              <button
                key={mode}
                type="button"
                data-testid={`sample-buffer-wrap-${mode}`}
                aria-pressed={active}
                title={mode === 'repeat' ? 'Wrap across opposite edges' : 'Stop sampling at the image edge'}
                onMouseDown={preventDrag}
                onClick={() => updateNodeData({ sampleWrap: mode })}
                style={{
                  flex: 1, background: active ? '#183c39' : '#242424',
                  border: `1px solid ${active ? TYPE_COLORS.buffer2d : '#404040'}`,
                  borderRadius: '4px', color: active ? '#7de3d9' : '#777',
                  fontSize: '8px', fontWeight: 700, padding: '4px 3px', cursor: 'pointer',
                }}
              >
                {mode.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '6px 10px 9px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '18px', position: 'relative' }}>
              <Handle type="target" position={Position.Left} id="buffer" title="Buffer2D from Frame Buffer"
                style={{ background: TYPE_COLORS.buffer2d, width: '10px', height: '10px', left: '-15px', border: '2px solid #1a1a1a' }} />
              <span style={{ fontSize: '10px', color: '#68d6cc' }}>Buffer2D</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '18px', position: 'relative' }}>
              <Handle type="target" position={Position.Left} id="uv" title="Optional UV; defaults to the current screen pixel"
                style={{ background: TYPE_COLORS.vec2, width: '10px', height: '10px', left: '-15px', border: '2px solid #1a1a1a' }} />
              <span style={{ fontSize: '9px', color: '#999' }}>UV (optional)</span>
            </div>
            {renderOffsetInput('x', 'offsetX')}
            {renderOffsetInput('y', 'offsetY')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', height: '18px', position: 'relative' }}>
            <span style={{ fontSize: '9px', color: '#ddd', marginRight: '4px' }}>RGB</span>
            <Handle type="source" position={Position.Right} id="rgb" title="Sampled RGB"
              style={{ background: TYPE_COLORS.vec3, width: '10px', height: '10px', right: '-15px', border: '2px solid #1a1a1a' }} />
          </div>
        </div>
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
              {hasFile ? text('Change file…', 'Zmień plik…') : text('Upload audio…', 'Wgraj dźwięk…')}
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
  if (def.id === 'code_block') {
    const callableName = codeBlockCallableName(String(currentLabel));
    const callableNameAvailable = isCodeBlockCallableNameAvailable(callableName);
    const duplicateCallableName = getNodes().some(node =>
      node.id !== id &&
      node.data?.definition?.id === 'code_block' &&
      codeBlockCallableName(String(node.data.label ?? node.data.definition.label)) === callableName);
    const callableSignature = formatCodeBlockSignature(String(currentLabel), def);
    const updatePorts = (
      direction: 'inputs' | 'outputs',
      ports: ShaderNodeDefinition['inputs'],
    ) => updateNodeData({ definition: { ...def, [direction]: ports } });

    const uniquePortId = (direction: 'inputs' | 'outputs', requested: string, currentIndex?: number) => {
      const ports = def[direction];
      const base = sanitizeCodePortId(requested, direction === 'inputs' ? 'input' : 'out');
      let candidate = base;
      let suffix = 2;
      while (ports.some((port, index) => index !== currentIndex && port.id === candidate)) {
        candidate = `${base}_${suffix}`;
        suffix += 1;
      }
      return candidate;
    };

    const renamePort = (direction: 'inputs' | 'outputs', index: number) => {
      const ports = def[direction];
      const oldId = ports[index].id;
      const nextId = uniquePortId(direction, ports[index].label, index);
      const next = ports.map((port, portIndex) => portIndex === index ? { ...port, id: nextId, label: nextId } : port);
      const expansionDirection = direction === 'inputs' ? 'inputs' : 'outputs';
      const expanded = new Set<string>(data.inlinePortExpansion?.[expansionDirection] || []);
      if (expanded.delete(oldId)) expanded.add(nextId);
      updateNodeData({
        definition: { ...def, [direction]: next },
        inlinePortExpansion: { ...data.inlinePortExpansion, [expansionDirection]: [...expanded] },
      });
      if (nextId !== oldId) {
        setEdges(current => current.map(edge => {
          const handle = direction === 'inputs' ? edge.targetHandle : edge.sourceHandle;
          const parsed = parseInlinePortHandle(handle);
          const belongsToPort = handle === oldId || parsed?.portId === oldId;
          if (!belongsToPort || (direction === 'inputs' ? edge.target !== id : edge.source !== id)) return edge;
          const renamedHandle = parsed
            ? inlinePortHandleId(parsed.direction, nextId, parsed.component)
            : nextId;
          return direction === 'inputs' ? { ...edge, targetHandle: renamedHandle } : { ...edge, sourceHandle: renamedHandle };
        }));
      }
    };

    const changePort = (direction: 'inputs' | 'outputs', index: number, changes: { label?: string; type?: string }) => {
      updatePorts(direction, def[direction].map((port, portIndex) => portIndex === index ? { ...port, ...changes } : port));
    };

    const addPort = (direction: 'inputs' | 'outputs') => {
      const ports = def[direction];
      const base = direction === 'inputs' ? `input${ports.length + 1}` : `out${ports.length + 1}`;
      const portId = uniquePortId(direction, base);
      updatePorts(direction, [...ports, { id: portId, label: portId, type: 'float' }]);
    };

    const removePort = (direction: 'inputs' | 'outputs', index: number) => {
      const port = def[direction][index];
      if (direction === 'outputs' && def.outputs.length === 1) return;
      const expansionDirection = direction === 'inputs' ? 'inputs' : 'outputs';
      updateNodeData({
        definition: { ...def, [direction]: def[direction].filter((_, portIndex) => portIndex !== index) },
        inlinePortExpansion: {
          ...data.inlinePortExpansion,
          [expansionDirection]: (data.inlinePortExpansion?.[expansionDirection] || []).filter((portId: string) => portId !== port.id),
        },
      });
      setEdges(current => current.filter(edge => {
        const handle = direction === 'inputs' ? edge.targetHandle : edge.sourceHandle;
        const parsed = parseInlinePortHandle(handle);
        const belongsToPort = handle === port.id || parsed?.portId === port.id;
        return !(belongsToPort && (direction === 'inputs' ? edge.target === id : edge.source === id));
      }));
    };

    const renderPortEditor = (direction: 'inputs' | 'outputs') => (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', color: '#999', fontWeight: 'bold' }}>{direction === 'inputs' ? 'INPUTS' : 'OUTPUTS'}</span>
          <button className="nodrag" onClick={() => addPort(direction)} style={{ fontSize: '10px', cursor: 'pointer', background: '#333', color: '#ddd', border: '1px solid #555', borderRadius: '3px' }}>+</button>
        </div>
        {def[direction].map((port, index) => (
          <div key={port.id} style={{ marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            {direction === 'inputs' && showParentPort('input', port.id) && <Handle type="target" position={Position.Left} id={port.id} title={`${port.label} · ${port.type}`} style={{ background: TYPE_COLORS[port.type], width: '10px', height: '10px', left: '-15px', border: '2px solid #111' }} />}
            {direction === 'inputs' && inlineToggle('input', port)}
            <input
              className="nodrag"
              value={port.label}
              onChange={event => changePort(direction, index, { label: event.target.value })}
              onBlur={() => renamePort(direction, index)}
              onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              onKeyUp={stopEditorKeyPropagation}
              spellCheck={false}
              title={text('GLSL variable name', 'Nazwa zmiennej GLSL')}
              style={{ width: '72px', minWidth: 0, background: '#151515', color: '#ddd', border: '1px solid #444', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px', padding: '3px' }}
            />
            <select
              className="nodrag"
              value={port.type}
              onChange={event => changePort(direction, index, { type: event.target.value })}
              style={{ minWidth: 0, flex: 1, background: '#222', color: TYPE_COLORS[port.type], border: '1px solid #444', borderRadius: '3px', fontSize: '9px', padding: '3px' }}
            >
              {CODE_BLOCK_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <button
              className="nodrag"
              onClick={() => removePort(direction, index)}
              disabled={direction === 'outputs' && def.outputs.length === 1}
              title={text('Remove port', 'Usuń port')}
              style={{ border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', padding: '1px 2px' }}
            >×</button>
            {direction === 'outputs' && inlineToggle('output', port)}
            {direction === 'outputs' && showParentPort('output', port.id) && <Handle type="source" position={Position.Right} id={port.id} title={`${port.label} · ${port.type}`} style={{ background: TYPE_COLORS[port.type], width: '10px', height: '10px', right: '-15px', border: '2px solid #111' }} />}
          </div>
          {isInlineExpanded(direction === 'inputs' ? 'input' : 'output', port.id) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', alignItems: direction === 'outputs' ? 'flex-end' : 'flex-start' }}>
              {vectorComponents(port.type).map(component => (
                <div key={component} style={{ position: 'relative', minWidth: '24px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: direction === 'outputs' ? 'flex-end' : 'flex-start' }}>
                  {direction === 'inputs' && <Handle type="target" position={Position.Left} id={inlinePortHandleId('input', port.id, component)} title={`${port.label}.${component} · float`} style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', left: '-15px', border: '2px solid #111' }} />}
                  <span style={{ fontSize: '9px', color: TYPE_COLORS.float, fontFamily: 'monospace' }}>{component.toUpperCase()}</span>
                  {direction === 'outputs' && <Handle type="source" position={Position.Right} id={inlinePortHandleId('output', port.id, component)} title={`${port.label}.${component} · float`} style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', right: '-15px', border: '2px solid #111' }} />}
                </div>
              ))}
            </div>
          )}
          </div>
        ))}
      </div>
    );

    return (
      <div style={{ ...baseStyle, width: '410px', position: 'relative' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: '#b56cff', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '5px 8px', background: '#222', borderBottom: '1px solid #333' }}>
          <input
            className="nodrag title-input"
            value={currentLabel}
            onChange={event => updateNodeData({ label: event.target.value })}
            onFocus={handleTitleFocus}
            onMouseDown={preventDrag}
            spellCheck={false}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#eee', fontWeight: 'bold', fontSize: '12px' }}
          />
        </div>
        <textarea
          className="nodrag"
          value={currentValue ?? ''}
          onChange={event => updateNodeData({ value: event.target.value })}
          onMouseDown={preventDrag}
          onKeyDown={stopEditorKeyPropagation}
          onKeyUp={stopEditorKeyPropagation}
          spellCheck={false}
          placeholder="float d = length(p);\nreturn d;"
          style={{ width: '100%', boxSizing: 'border-box', height: '220px', resize: 'vertical', background: '#0d0d0d', color: '#9cdcfe', border: 'none', borderBottom: '1px solid #333', outline: 'none', padding: '8px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.45 }}
        />
        <div style={{ padding: '5px 8px', color: '#888', background: '#171717', fontSize: '9px' }}>
          {def.outputs.length === 1
            ? text(`Return ${def.outputs[0].type} with: return ...;`, `Zwróć ${def.outputs[0].type} przez: return ...;`)
            : text(`Multiple outputs: assign ${def.outputs.map(port => port.id).join(', ')} (out parameters).`, `Wiele wyjść: przypisz wartości do ${def.outputs.map(port => port.id).join(', ')} (parametry out).`)}
        </div>
        <div
          data-testid="code-block-signature"
          style={{
            padding: '6px 8px',
            color: callableNameAvailable && !duplicateCallableName ? '#b9e6b0' : '#ffb36b',
            background: '#121a14',
            borderBottom: '1px solid #333',
            fontFamily: 'monospace',
            fontSize: '10px',
          }}
          title={text('Use this name inside another Code Block, including loops.', 'Tej nazwy możesz użyć wewnątrz innego Code Blocka, także w pętli.')}
        >
          {callableNameAvailable && !duplicateCallableName
            ? <>{text('In other Code Blocks:', 'W innych Code Blockach:')} <strong>{callableSignature}</strong></>
            : duplicateCallableName
              ? <>{text(`Ambiguous function: rename the duplicate “${callableName}”.`, `Niejednoznaczna funkcja: zmień powtarzającą się nazwę „${callableName}”.`)}</>
              : <>{text(`“${callableName}” is a GLSL built-in — rename the block to call it.`, `Nazwa „${callableName}” jest wbudowana w GLSL — zmień tytuł, aby wywoływać ten blok.`)}</>}
        </div>
        <div style={{ display: 'flex', gap: '14px', padding: '8px 12px 7px' }}>
          {renderPortEditor('inputs')}
          {renderPortEditor('outputs')}
        </div>
      </div>
    );
  }

  if (def.id === 'loop_iterate') {
    const compatibleSteps = loadCustomNodes().filter(isCompatibleLoopStep);
    const selectedStepId = String(data.loopStepId ?? '');
    const selectedStep = compatibleSteps.find(step => step.id === selectedStepId);
    const stateType = selectedStep ? loopStateType(selectedStep) : (def.inputs[0]?.type || 'float');
    const iterations = clampLoopIterations(data.iterations);

    const selectStep = (stepId: string) => {
      const step = compatibleSteps.find(candidate => candidate.id === stepId);
      if (!step) {
        updateNodeData({ loopStepId: '' });
        return;
      }
      const nextType = loopStateType(step);
      updateNodeData({
        loopStepId: step.id,
        definition: {
          ...def,
          inputs: [{ id: 'initial', label: 'Initial State', type: nextType }],
          outputs: [{ id: 'result', label: 'Final State', type: nextType }],
        },
      });
    };

    const commitIterations = () => {
      const next = clampLoopIterations(loopIterationDraft);
      setLoopIterationDraft(String(next));
      updateNodeData({ iterations: next });
    };

    return (
      <div style={{ ...baseStyle, width: '250px', position: 'relative', overflow: 'visible' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: '#ff9f43', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
        <div style={{ padding: '6px 9px', background: '#222', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>↻ LOOP / ITERATE</span>
          <span style={{ fontSize: '9px', color: '#ffbf7a', fontFamily: 'monospace' }}>{stateType}</span>
        </div>

        <div className="nodrag" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: '#aaa' }}>
            VISUAL STEP (CUSTOM NODE)
            <select
              value={selectedStepId}
              onChange={event => selectStep(event.target.value)}
              onKeyDown={stopEditorKeyPropagation}
              onKeyUp={stopEditorKeyPropagation}
              style={{ background: '#181818', color: '#eee', border: '1px solid #555', borderRadius: '4px', padding: '5px', fontSize: '11px' }}
            >
              <option value="">— choose Step —</option>
              {compatibleSteps.map(step => (
                <option key={step.id} value={step.id}>{step.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '9px', color: '#aaa' }}>
            ITERATIONS
            <input
              aria-label="Loop iterations"
              value={loopIterationDraft}
              inputMode="numeric"
              onChange={event => setLoopIterationDraft(event.target.value)}
              onBlur={commitIterations}
              onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setLoopIterationDraft(String(iterations));
                  event.currentTarget.blur();
                }
              }}
              onKeyUp={stopEditorKeyPropagation}
              style={{ width: '70px', background: '#181818', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '4px 6px', fontFamily: 'monospace', fontSize: '11px', textAlign: 'right' }}
              title={`Integer from 1 to ${LOOP_MAX_ITERATIONS}`}
            />
          </label>

          <div style={{ fontSize: '9px', lineHeight: 1.45, color: selectedStep ? '#9ed59e' : '#d39a6b', borderTop: '1px solid #303030', paddingTop: '7px' }}>
            {selectedStep
              ? <>Step: <strong>{stateType} State</strong>{selectedStep.inputs[1] ? ' · float Index' : ''}{selectedStep.inputs[2] ? ' · float Progress' : ''} → <strong>{stateType} Next</strong>{selectedStep.outputs[1] ? ' · float Stop' : ''}</>
              : compatibleSteps.length > 0
                ? 'Choose a compatible Custom Node to use as the iteration body.'
                : 'Create a Custom Node: State → Next State. Optional inputs: Index, Progress; optional output: Stop.'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px 9px', borderTop: '1px solid #303030' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Handle type="target" position={Position.Left} id="initial" title={`Initial State · ${stateType}`}
              style={{ background: TYPE_COLORS[stateType], width: '10px', height: '10px', left: '-15px', border: '2px solid #111' }} />
            <span style={{ fontSize: '10px', color: '#ccc' }}>Initial State</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#fff', marginRight: '5px' }}>Final State</span>
            <Handle type="source" position={Position.Right} id="result" title={`Final State · ${stateType}`}
              style={{ background: TYPE_COLORS[stateType], width: '10px', height: '10px', right: '-15px', border: '2px solid #111' }} />
          </div>
        </div>
      </div>
    );
  }

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
          onChange={(e) => {
            const value = e.target.value;
            const inferredType = inferCodeExpressionType(value);
            updateNodeData({
              value,
              ...(inferredType && inferredType !== outType ? {
                definition: { ...def, outputs: [{ id: 'out', label: 'Out', type: inferredType }] },
              } : {}),
            });
          }}
          spellCheck={false}
          onKeyDown={stopEditorKeyPropagation}
          onKeyUp={stopEditorKeyPropagation}
          placeholder={text('e.g. sin(a * 6.28) + b', 'np. sin(a * 6.28) + b')}
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
              title={text(`Output type: ${t}`, `Typ wyjścia: ${t}`)}
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
              <div key={input.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '14px', position: 'relative' }}>
                {showParentPort('input', input.id) && <Handle
                  type="target" position={Position.Left} id={input.id}
                  style={{ background: TYPE_COLORS[input.type], width: '10px', height: '10px', left: '-13px', border: '2px solid #1a1a1a' }}
                />}
                {inlineToggle('input', input)}
                <span style={{ fontSize: '10px', color: '#ccc', fontFamily: 'monospace' }}>{input.id}</span>
              </div>
              {isInlineExpanded('input', input.id) && vectorComponents(input.type).map(component => (
                <div key={component} style={{ position: 'relative', height: '12px', paddingLeft: '10px', display: 'flex', alignItems: 'center' }}>
                  <Handle type="target" position={Position.Left} id={inlinePortHandleId('input', input.id, component)} title={`${input.id}.${component} · float`} style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', left: '-13px', border: '2px solid #1a1a1a' }} />
                  <span style={{ fontSize: '9px', color: TYPE_COLORS.float, fontFamily: 'monospace' }}>{component.toUpperCase()}</span>
                </div>
              ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', position: 'relative', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
            <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>Out</span>
            {inlineToggle('output', def.outputs[0])}
            {showParentPort('output', 'out') && <Handle
              type="source" position={Position.Right} id="out"
              style={{ background: TYPE_COLORS[outType], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }}
            />}
            </div>
            {isInlineExpanded('output', 'out') && vectorComponents(outType).map(component => (
              <div key={component} style={{ position: 'relative', height: '12px', paddingRight: '8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: TYPE_COLORS.float, fontFamily: 'monospace' }}>{component.toUpperCase()}</span>
                <Handle type="source" position={Position.Right} id={inlinePortHandleId('output', 'out', component)} title={`Out.${component} · float`} style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', right: '-13px', border: '2px solid #1a1a1a' }} />
              </div>
            ))}
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
      ? (resolved ? `input · ${formatEditableFloat(value)}${suffix}` : 'dynamic input')
      : `default · ${formatEditableFloat(value)}${suffix}`;

    return (
      <div style={{ ...baseStyle, width: '184px', position: 'relative', overflow: 'visible' }}>
        {renderInfoIcon()}
        <div style={{ height: '4px', background: TYPE_COLORS.impulse, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
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
              <span style={{ fontSize: '10px', color: impulseActive ? '#b3e5fc' : '#aaa', marginRight: '6px', fontWeight: 'bold' }}>Event · IMPULSE</span>
              <Handle type="source" position={Position.Right} id="out" title="Impulse event (stored as 0/1 only inside the shader)"
                style={{ background: TYPE_COLORS.impulse, width: '10px', height: '10px', right: '-15px', border: '2px solid #1a1a1a' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (def.compact) {
    const compactInputs = def.inputs.flatMap(input => [
      ...(showParentPort('input', input.id) ? [{ ...input, inline: false, parentId: input.id, parentLabel: input.label, parentType: input.type }] : []),
      ...(isInlineExpanded('input', input.id)
        ? vectorComponents(input.type).map(component => ({
            id: inlinePortHandleId('input', input.id, component),
            label: `${input.label}.${component.toUpperCase()}`, type: 'float', inline: true,
            parentId: input.id, parentLabel: input.label, parentType: input.type,
          }))
        : []),
    ]);
    const compactOutputs = def.outputs.flatMap(output => [
      ...(showParentPort('output', output.id) ? [{ ...output, inline: false, parentId: output.id, parentLabel: output.label, parentType: output.type }] : []),
      ...(isInlineExpanded('output', output.id)
        ? vectorComponents(output.type).map(component => ({
            id: inlinePortHandleId('output', output.id, component),
            label: `${output.label}.${component.toUpperCase()}`, type: 'float', inline: true,
            parentId: output.id, parentLabel: output.label, parentType: output.type,
          }))
        : []),
    ]);
    const compactHeight = Math.max(38, Math.max(compactInputs.length, compactOutputs.length) * 19 + 10);
    return (
      <div
        title={`${def.description || currentLabel}\n${text('Right-click a vector port to split or collapse its components.', 'Kliknij prawym przyciskiem port wektorowy, aby rozdzielić lub zwinąć składowe.')}`}
        style={{ ...baseStyle, borderRadius: '16px', padding: '0 44px', minWidth: '72px', height: `${compactHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
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
            {compactInputs.map((input, i) => {
                 const isAuto = input.type === 'auto';
                 const isMultiType = input.type.includes('|');
                 
                 return <div key={`input-${input.id}-${i}`} data-port-label={input.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: '52px', height: '16px' }}>
                   <Handle
                     type="target"
                     position={Position.Left}
                     id={input.id}
                     title={`${input.label} · ${input.type}`}
                     onContextMenu={(event) => {
                       if (!isVectorType(input.parentType)) return;
                       event.preventDefault(); event.stopPropagation();
                       setInlinePortMenu({ x: event.clientX, y: event.clientY, direction: 'input', portId: input.parentId, portLabel: input.parentLabel, portType: input.parentType });
                     }}
                     className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                     style={{
                       background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[input.type],
                       width: '10px', height: '10px', border: '2px solid #1a1a1a', position: 'relative',
                       left: 0, top: 'auto', transform: 'none', display: 'flex', alignItems: 'center',
                       justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
                     }}
                   >
                     {isMultiType && <MultiTypeIndicator types={input.type} size={10} />}
                   </Handle>
                   <span style={{ fontSize: '8px', color: input.inline ? TYPE_COLORS.float : '#aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{input.label}</span>
                 </div>
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
            {compactOutputs.map((output, i) => {
                const isAuto = output.type === 'auto';
                const isMultiType = output.type.includes('|');
                
                return <div key={`output-${output.id}-${i}`} data-port-label={output.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', minWidth: '60px', height: '16px' }}>
                  <span style={{ fontSize: '8px', color: output.inline ? TYPE_COLORS.float : '#aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{output.label}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output.id}
                    title={`${output.label} · ${output.type}`}
                    onContextMenu={(event) => {
                      if (!isVectorType(output.parentType)) return;
                      event.preventDefault(); event.stopPropagation();
                      setInlinePortMenu({ x: event.clientX, y: event.clientY, direction: 'output', portId: output.parentId, portLabel: output.parentLabel, portType: output.parentType });
                    }}
                    className={`handle-inline${isAuto ? ' port-auto' : ''}`}
                    style={{
                      background: (isAuto || isMultiType) ? 'transparent' : TYPE_COLORS[output.type],
                      width: '10px', height: '10px', border: '2px solid #1a1a1a', position: 'relative',
                      right: 0, top: 'auto', transform: 'none', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
                    }}
                  >
                    {isMultiType && <MultiTypeIndicator types={output.type} size={10} />}
                  </Handle>
                </div>
            })}
        </div>
        {inlinePortMenu && (
          <InlinePortContextMenu
            {...inlinePortMenu}
            expanded={isInlineExpanded(inlinePortMenu.direction, inlinePortMenu.portId)}
            canCollapse={!hasInlineComponentEdges(inlinePortMenu.direction, inlinePortMenu.portId)}
            onToggle={() => toggleInlinePort(inlinePortMenu.direction, inlinePortMenu.portId)}
            onClose={() => setInlinePortMenu(null)}
          />
        )}
      </div>
    );
  }

  if (isFloatParam) {
    const dynamicWidth = `${Math.min(18, Math.max(4, displayedFloatValue.length) + 2)}ch`;
    const settingInputStyle: React.CSSProperties = {
      background: '#111', border: '1px solid #333', borderRadius: '3px', color: '#bbb',
      fontSize: '9px', width: '46px', textAlign: 'center', outline: 'none', padding: '2px',
    };
    const setFromSlider = (value: string) => {
      setFloatDraft(value);
      updateNodeData({ value });
    };

    return (
        <div style={{ ...baseStyle, minWidth: '174px' }}>
             {renderInfoIcon()}
             <div style={{ height: '4px', background: headerColorBase, borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }} />
             
             <div style={{ padding: '2px 8px', background: '#222', borderBottom: '1px solid #333' }}>
                <input className="nodrag title-input" value={currentLabel} onChange={(e) => updateNodeData({ label: e.target.value })} spellCheck={false} autoComplete="off" style={{ background: 'transparent', border: 'none', color: '#ccc', fontWeight: 'bold', fontSize: '11px', width: '100%', outline: 'none' }} placeholder={def.label} onFocus={handleTitleFocus} onMouseDown={preventDrag} />
             </div>

             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <button type="button" aria-label="Float settings" onMouseDown={preventDrag} onClick={() => setShowSettings(!showSettings)} style={{ cursor: 'pointer', fontSize: '12px', color: showSettings ? '#ff007a' : '#777', padding: '2px', lineHeight: 1, background: 'transparent', border: 0 }}>⚙️</button>
                     <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <button
                          type="button"
                          aria-label="Decrease float"
                          onMouseDown={preventDrag}
                          onClick={() => nudgeFloat(-1)}
                          style={{ cursor: 'pointer', color: '#aaa', fontSize: '15px', userSelect: 'none', width: '22px', height: '24px', lineHeight: 1, background: '#292929', border: '1px solid #3d3d3d', borderRadius: '4px' }}
                        >−</button>
                        <input
                          type="text"
                          inputMode="decimal"
                          data-testid="float-value-input"
                          aria-label="Float value"
                          value={displayedFloatValue}
                          onChange={(event) => {
                            if (!floatEditing) setFloatEditing(true);
                            setFloatDraft(event.target.value);
                          }}
                          onFocus={() => {
                            setFloatDraft(String(currentValue));
                            setFloatEditing(true);
                          }}
                          onBlur={() => {
                            setFloatEditing(false);
                            if (skipFloatCommitRef.current) {
                              skipFloatCommitRef.current = false;
                              return;
                            }
                            commitFloatDraft();
                          }}
                          onKeyDown={handleFloatKeyDown}
                          style={{ background: '#111', border: `1px solid ${floatEditing ? '#ff007a' : '#383838'}`, borderRadius: '4px', color: '#ff4d94', fontSize: '16px', fontWeight: 'bold', width: dynamicWidth, minWidth: '54px', maxWidth: '150px', textAlign: 'center', outline: 'none', padding: '3px 5px', margin: 0, fontFamily: 'monospace' }}
                          onMouseDown={preventDrag}
                        />
                        <button
                          type="button"
                          aria-label="Increase float"
                          onMouseDown={preventDrag}
                          onClick={() => nudgeFloat(1)}
                          style={{ cursor: 'pointer', color: '#aaa', fontSize: '15px', userSelect: 'none', width: '22px', height: '24px', lineHeight: 1, background: '#292929', border: '1px solid #3d3d3d', borderRadius: '4px' }}
                        >+</button>
                     </div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#aaa', marginRight: '6px' }}>Val</span>
                    <Handle type="source" position={Position.Right} id="out" style={{ background: TYPE_COLORS['float'], width: '10px', height: '10px', right: '-13px', border: '2px solid #1a1a1a' }} />
                 </div>
             </div>

             <div style={{ padding: '0 10px 5px', color: '#666', fontSize: '8px', textAlign: 'center' }}>
               Enter applies · ↑/↓ step · Shift ×10 · Alt ×0.1
             </div>

             {showSettings && (
                 <div className="nodrag" style={{ margin: '0 8px 8px 8px', background: '#222', padding: '6px', borderRadius: '4px', borderTop: '1px solid #333' }}>
                    <input aria-label="Float slider" type="range" min={currentMin} max={currentMax} step={currentStep} value={parseEditableFloat(currentValue) ?? 0} onChange={(e) => setFromSlider(e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: '#ff007a', height: '6px' }} onMouseDown={preventDrag} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginTop: '5px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '8px', color: '#777' }}>MIN</span><input aria-label="Float minimum" type="number" value={currentMin} onChange={(e) => { const value = parseEditableFloat(e.target.value); if (value !== null) updateNodeData({ min: value }); }} style={settingInputStyle} onMouseDown={preventDrag} /></label>
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '8px', color: '#777' }}>STEP</span><input aria-label="Float step" type="number" min="0.000000001" value={currentStep} onChange={(e) => { const value = parseEditableFloat(e.target.value); if (value !== null && value > 0) updateNodeData({ step: value }); }} style={settingInputStyle} onMouseDown={preventDrag} /></label>
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '8px', color: '#777' }}>MAX</span><input aria-label="Float maximum" type="number" value={currentMax} onChange={(e) => { const value = parseEditableFloat(e.target.value); if (value !== null) updateNodeData({ max: value }); }} style={settingInputStyle} onMouseDown={preventDrag} /></label>
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
                      <div key={input.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          {showParentPort('input', input.id) && <Handle
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
                          </Handle>}
                          {inlineToggle('input', input)}
                          <span style={{ fontSize: '10px', color: '#ccc' }}>{input.label}</span>
                        </div>
                        {isInlineExpanded('input', input.id) && vectorComponents(input.type).map(component => (
                          <div key={component} style={{ display: 'flex', alignItems: 'center', height: '14px', position: 'relative', paddingLeft: '10px' }}>
                            <Handle
                              type="target" position={Position.Left}
                              id={inlinePortHandleId('input', input.id, component)}
                              title={`${input.label}.${component} · float`}
                              style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', left: '-13px', border: '2px solid #1a1a1a' }}
                            />
                            <span style={{ fontSize: '9px', color: TYPE_COLORS.float, fontFamily: 'monospace' }}>{component.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {def.outputs.map((output) => {
                    const isAuto = output.type === 'auto';
                    const isMultiType = output.type.includes('|');
                    
                    return (
                      <div key={output.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', height: '16px', position: 'relative' }}>
                          <span style={{ fontSize: '10px', color: '#ccc', marginRight: '4px' }}>{output.label}</span>
                          {inlineToggle('output', output)}
                          {showParentPort('output', output.id) && <Handle
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
                          </Handle>}
                        </div>
                        {isInlineExpanded('output', output.id) && vectorComponents(output.type).map(component => (
                          <div key={component} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '14px', position: 'relative', paddingRight: '10px' }}>
                            <span style={{ fontSize: '9px', color: TYPE_COLORS.float, fontFamily: 'monospace' }}>{component.toUpperCase()}</span>
                            <Handle
                              type="source" position={Position.Right}
                              id={inlinePortHandleId('output', output.id, component)}
                              title={`${output.label}.${component} · float`}
                              style={{ background: TYPE_COLORS.float, width: '8px', height: '8px', right: '-13px', border: '2px solid #1a1a1a' }}
                            />
                          </div>
                        ))}
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
                    {['float', 'impulse', 'vec2', 'vec3', 'vec4'].map(t => (
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
                            {t === 'float' ? '1' : t === 'impulse' ? '⚡' : t.slice(-1)}
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
