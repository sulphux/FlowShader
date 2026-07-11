import type { Node, Edge, Viewport } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';
import { loadCustomNodes } from './customNodeManager';
import type { ShaderNodeDefinition } from './types';
import { computeSmartSplitPorts } from './smartSplitAdapter';

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
  };
  [key: string]: unknown;
}

export interface SerializedGraph {
  nodes: SerializedNode[];
  edges: Edge[];
  viewport?: Viewport;
}

const findDefinition = (defId: string): ShaderNodeDefinition | undefined => {
  const registryDef = Object.values(NODE_REGISTRY).find(d => d.id === defId);
  if (registryDef) return registryDef;
  // Custom nody mogą nie być jeszcze wpięte do NODE_REGISTRY (ładowane w efekcie po mount)
  return loadCustomNodes().find(d => d.id === defId);
};

const portsDiffer = (def: ShaderNodeDefinition, registryDef: ShaderNodeDefinition): boolean => {
  const key = (d: ShaderNodeDefinition) => JSON.stringify({ i: d.inputs, o: d.outputs });
  return key(def) !== key(registryDef);
};

export function serializeGraph(nodes: Node[], edges: Edge[], viewport?: Viewport): SerializedGraph {
  return {
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
  const migratedEdges = migrateLegacyEdges(parsed.nodes || [], parsed.edges || []);
  const edges = dropOrphanedEdges(parsed.nodes || [], migratedEdges);
  const nodesWithSavedPorts = new Set<string>();

  const restoredNodes: Node[] = (parsed.nodes || []).map(n => {
    const savedDef = n.data.definition;
    const baseDef = findDefinition(savedDef.id) || NODE_REGISTRY['output'];

    let type = 'shaderNode';
    if (savedDef.id === 'preview') type = 'previewNode';
    if (savedDef.id === 'monitor') type = 'monitorNode';
    if (savedDef.id === 'color_preview') type = 'colorPreviewNode';

    let definition: ShaderNodeDefinition = baseDef;
    if (savedDef.inputs && savedDef.outputs) {
      definition = { ...baseDef, inputs: savedDef.inputs, outputs: savedDef.outputs };
      nodesWithSavedPorts.add(n.id);
    }

    return {
      ...n,
      type,
      data: { ...n.data, definition },
    } as Node;
  });

  // Adaptacja tylko tam, gdzie zapis nie zawierał już zaadaptowanych portów
  const adaptedNodes = restoredNodes.map(node =>
    nodesWithSavedPorts.has(node.id) ? node : adaptAutoNode(node, restoredNodes, edges)
  );

  return { nodes: adaptedNodes, edges, viewport: parsed.viewport };
}
