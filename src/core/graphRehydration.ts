import type { Node, Edge, Viewport } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { loadCustomNodes, collectUsedCustomNodes, importEmbeddedCustomNodes, type CustomNodeDefinition } from './customNodeManager';
import type { ShaderNodeDefinition } from './types';
import { computeSmartSplitPorts } from './smartSplitAdapter';
import { TYPE_COLORS } from './theme';
import { resolveFrameBufferMode, type FrameBufferMode } from './frameBufferMode';

/**
 * Wspólna serializacja/rehydracja grafu.
 *
 * Zapis przechowuje definition jako { id } (funkcje glslTemplate nie są
 * serializowalne w JSON), a przy wczytaniu definicja jest odtwarzana
 * z NODE_REGISTRY. Nody, których porty zostały zmienione w locie
 * (smart_split, smart_compose, relay_auto), zapisują dodatkowo inputs/outputs,
 * żeby nie tracić adaptacji po wczytaniu.
 *
 * Ta logika była wcześniej zduplikowana (i rozjechana) między getInitialData
 * (refresh z localStorage) a restoreGraph (Load z pliku) w NodeEditor —
 * refresh nie adaptował smart_split/relay_auto, przez co wczytany graf
 * generował niepoprawny GLSL (np. vec3 var = <vec2 expr>).
 */

interface SerializedPort {
  id: string;
  label: string;
  type: string;
}

interface SerializedNode {
  id: string;
  type?: string;
  data: {
    definition: { id: string; inputs?: SerializedPort[]; outputs?: SerializedPort[] };
    value?: unknown;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    detectedType?: string;
    forcedType?: string;
    captureMode?: FrameBufferMode;
    sampleWrap?: 'repeat' | 'clamp';
    offsetX?: number;
    offsetY?: number;
  };
  [key: string]: unknown;
}

export interface SerializedGraph {
  nodes: SerializedNode[];
  edges: Edge[];
  viewport?: Viewport;
  /**
   * Full definitions of every custom node used in this graph (including
   * nested ones), embedded so the save is self-contained. Without this, a
   * shared project only carried {id: "custom_x"} references — opening it
   * anywhere the recipient's browser didn't already have that exact custom
   * node showed a "Missing node" placeholder instead of working.
   */
  customNodes?: CustomNodeDefinition[];
}

const findDefinition = (defId: string): ShaderNodeDefinition | undefined => {
  const registryDef = Object.values(NODE_REGISTRY).find(d => d.id === defId);
  if (registryDef) return registryDef;
  // Custom nody mogą nie być jeszcze wpięte do NODE_REGISTRY (ładowane w efekcie po mount)
  return loadCustomNodes().find(d => d.id === defId);
};

/**
 * Placeholder dla nodu, którego definicji nie da się odtworzyć — najczęściej
 * custom node zapisany w innej przeglądarce/profilu (biblioteka custom nodów
 * żyje w localStorage, nie w pliku zapisu). Wcześniej brakująca definicja
 * cicho fallbackowała na NODE_REGISTRY['output'], więc taki node wyglądał
 * i zachowywał się jak prawdziwy Output — mylące i ryzykowne (drugi node
 * z id 'output' w grafie). Placeholder ma 0 portów, więc kompilator go
 * pomija (jak każdy node bez wyjść, który nie jest celem kompilacji).
 */
const buildMissingDefinition = (defId: string): ShaderNodeDefinition => ({
  id: '__missing__',
  label: `Missing: ${defId}`,
  inputs: [],
  outputs: [],
  glslTemplate: () => 'vec3(0.0)',
  description: `Node type "${defId}" wasn't found — likely a custom node saved in a different browser/profile, or since deleted from the library.`,
  missingOriginalId: defId,
});

const portsDiffer = (def: ShaderNodeDefinition, registryDef: ShaderNodeDefinition): boolean => {
  const key = (d: ShaderNodeDefinition) => JSON.stringify({ i: d.inputs, o: d.outputs });
  return key(def) !== key(registryDef);
};

export function serializeGraph(nodes: Node[], edges: Edge[], viewport?: Viewport): SerializedGraph {
  const usedCustomNodes = collectUsedCustomNodes(nodes);
  return {
    ...(usedCustomNodes.length > 0 ? { customNodes: usedCustomNodes } : {}),
    nodes: nodes.map(n => {
      const def = n.data.definition as ShaderNodeDefinition;
      const registryDef = findDefinition(def.id);
      const keepPorts = registryDef ? portsDiffer(def, registryDef) : false;
      return {
        ...n,
        data: {
          definition: keepPorts
            ? { id: def.id, inputs: def.inputs, outputs: def.outputs }
            : { id: def.id },
          value: n.data.value,
          label: n.data.label,
          min: n.data.min,
          max: n.data.max,
          step: n.data.step,
          // Custom Input/Output type resolution — dropping these while keeping
          // the adapted port types in the definition made the compiler and the
          // nodes' glslTemplates disagree about the variable type after reload
          detectedType: n.data.detectedType,
          forcedType: n.data.forcedType,
          captureMode: n.data.captureMode,
          sampleWrap: n.data.sampleWrap,
          offsetX: n.data.offsetX,
          offsetY: n.data.offsetY,
        },
      } as SerializedNode;
    }),
    edges,
    viewport,
  };
}

/**
 * Starsze wersje auto-adaptera tworzyły krawędzie z sourceHandle 'result',
 * podczas gdy nody Combine definiują wyjście 'out'. Kompilator nie znajdował
 * wtedy typu wyjścia i fallbackował do float — stąd m.in. utrata kanału W.
 */
const migrateLegacyEdges = (nodes: SerializedNode[], edges: Edge[]): Edge[] => {
  return (edges || []).map(edge => {
    if (edge.sourceHandle !== 'result') return edge;
    const sourceNode = nodes.find(n => n.id === edge.source);
    const sourceDefId = sourceNode?.data?.definition?.id || '';
    if (sourceDefId.startsWith('combine')) {
      return { ...edge, sourceHandle: 'out' };
    }
    return edge;
  });
};

/**
 * Adaptacja portów smart_split / relay_auto na podstawie istniejących połączeń.
 * Pomijana, gdy użytkownik ręcznie wymusił typ (data.forcedType) — wtedy ten
 * typ wygrywa niezależnie od tego, co akurat jest podłączone.
 */
const adaptAutoNode = (node: Node, nodes: Node[], edges: Edge[]): Node => {
  const def = node.data.definition as ShaderNodeDefinition;
  if (def.id !== 'smart_split' && def.id !== 'relay_auto') return node;

  const forcedType = node.data.forcedType as string | undefined;
  let type = forcedType;

  if (!type) {
    const inputEdge = edges.find(e => e.target === node.id && e.targetHandle === 'in');
    if (!inputEdge) return node;
    const sourceNode = nodes.find(n => n.id === inputEdge.source);
    if (!sourceNode) return node;

    const sourceDef = sourceNode.data.definition as ShaderNodeDefinition;
    const outputDef = sourceDef.outputs.find(o => o.id === inputEdge.sourceHandle) || sourceDef.outputs[0];
    if (!outputDef) return node;
    type = outputDef.type;
  }

  if (def.id === 'relay_auto') {
    return {
      ...node,
      data: {
        ...node.data,
        definition: {
          ...def,
          inputs: [{ id: 'in', label: type, type }],
          outputs: [{ id: 'out', label: type, type }],
        },
      },
    };
  }

  // smart_split
  const adapted = computeSmartSplitPorts(type);
  return {
    ...node,
    data: {
      ...node.data,
      definition: {
        ...def,
        inputs: [{ id: 'in', label: adapted.inputLabel, type }],
        outputs: adapted.outputs,
      },
    },
  };
};

/**
 * Drops edges whose source or target node doesn't exist in the graph.
 * These can appear in older saves from before deleteSelected() (NodeEditor.tsx)
 * cleaned up edges connected to a deleted node — the node was removed but its
 * edges weren't, leaving dangling references. Harmless to the compiler
 * (missing sources are just skipped) but they're dead weight and confusing
 * when inspecting a saved file, so we clean them up on load.
 */
const dropOrphanedEdges = (nodes: SerializedNode[], edges: Edge[]): Edge[] => {
  const nodeIds = new Set(nodes.map(n => n.id));
  return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
};

export function rehydrateGraph(parsed: SerializedGraph): { nodes: Node[]; edges: Edge[]; viewport?: Viewport } {
  // Register any custom nodes embedded in the file BEFORE resolving node
  // definitions below (findDefinition falls back to loadCustomNodes(), so
  // this must run first for a just-imported custom node to resolve instead
  // of showing "Missing node").
  const imported = importEmbeddedCustomNodes(parsed.customNodes);
  if (imported && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('customNodesUpdated'));
  }

  const migratedEdges = migrateLegacyEdges(parsed.nodes || [], parsed.edges || []);
  const edges = dropOrphanedEdges(parsed.nodes || [], migratedEdges);
  const nodesWithSavedPorts = new Set<string>();

  const restoredNodes: Node[] = (parsed.nodes || []).map(n => {
    const savedDef = n.data.definition;
    const baseDef = findDefinition(savedDef.id) || buildMissingDefinition(savedDef.id);

    let type = 'shaderNode';
    if (savedDef.id === 'preview') type = 'previewNode';
    if (savedDef.id === 'monitor') type = 'monitorNode';
    if (savedDef.id === 'color_preview') type = 'colorPreviewNode';

    let definition: ShaderNodeDefinition = baseDef;
    if (savedDef.inputs && savedDef.outputs) {
      definition = { ...baseDef, inputs: savedDef.inputs, outputs: savedDef.outputs };
      nodesWithSavedPorts.add(n.id);
    }

    const restoredData = {
      ...n.data,
      definition,
      ...(savedDef.id === 'feedback'
        ? { captureMode: resolveFrameBufferMode(n, edges) }
        : {}),
    };

    return {
      ...n,
      type,
      data: restoredData,
    } as Node;
  });

  // Adaptacja tylko tam, gdzie zapis nie zawierał już zaadaptowanych portów
  const adaptedNodes = restoredNodes.map(node =>
    nodesWithSavedPorts.has(node.id) ? node : adaptAutoNode(node, restoredNodes, edges)
  );

  // Edge rendering is derived from the restored source port. This upgrades
  // older project files automatically when a former float output becomes the
  // semantic impulse type.
  const decoratedEdges = edges.map(edge => {
    const sourceNode = adaptedNodes.find(node => node.id === edge.source);
    const sourceDef = sourceNode?.data?.definition as ShaderNodeDefinition | undefined;
    const sourcePort = sourceDef?.outputs.find(output => output.id === edge.sourceHandle);
    if (sourcePort?.type !== 'impulse') return edge;
    return {
      ...edge,
      type: 'impulse',
      animated: false,
      style: { ...edge.style, stroke: TYPE_COLORS.impulse, strokeWidth: 3 },
    };
  });

  return { nodes: adaptedNodes, edges: decoratedEdges, viewport: parsed.viewport };
}
