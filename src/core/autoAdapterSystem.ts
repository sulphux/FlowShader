import type { Edge, Node } from 'reactflow';
import type { DataType } from './types';
import { TYPE_COLORS } from './theme';
import {
  inlinePortHandleId,
  type InlinePortDirection,
  type VectorType,
  vectorComponents,
} from './inlinePortAdapters';

interface Connection {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface AdapterResult {
  newNodes: Node[];
  updatedNodes: Node[];
  newEdges: Edge[];
}

type AdapterType = 'combine' | 'split' | 'split-combine' | null;

const emptyResult = (): AdapterResult => ({ newNodes: [], updatedNodes: [], newEdges: [] });

function resolveTargetType(sourceType: DataType, targetType: string): DataType {
  if (!targetType.includes('|')) return targetType as DataType;
  const options = targetType.split('|') as DataType[];
  if (options.includes(sourceType)) return sourceType;
  const vectorOption = options.find(option => ['vec2', 'vec3', 'vec4'].includes(option));
  if (vectorOption) return vectorOption;
  if (options.includes('float')) return 'float';
  return options[0];
}

function detectAdapterType(sourceType: DataType, targetType: DataType): AdapterType {
  const sourceIsVector = ['vec2', 'vec3', 'vec4'].includes(sourceType);
  const targetIsVector = ['vec2', 'vec3', 'vec4'].includes(targetType);
  if (sourceType === 'float' && targetIsVector) return 'combine';
  if (sourceIsVector && targetType === 'float') return 'split';
  if (sourceIsVector && targetIsVector && sourceType !== targetType) return 'split-combine';
  return null;
}

function expandPort(node: Node, direction: InlinePortDirection, portId: string): Node {
  const key = direction === 'input' ? 'inputs' : 'outputs';
  const current = node.data.inlinePortExpansion || {};
  const expanded = new Set<string>(current[key] || []);
  expanded.add(portId);
  return {
    ...node,
    data: {
      ...node.data,
      inlinePortExpansion: { ...current, [key]: [...expanded] },
    },
  };
}

function componentEdge(
  params: Connection,
  sourceHandle: string,
  targetHandle: string,
  component: string,
): Edge {
  return {
    id: `inline_${params.source}_${sourceHandle}_${params.target}_${targetHandle}_${component}`,
    source: params.source,
    sourceHandle,
    target: params.target,
    targetHandle,
    type: 'default',
    style: { stroke: TYPE_COLORS.float, strokeWidth: 3 },
  };
}

/**
 * Adapts incompatible scalar/vector connections by expanding the original
 * ports inside their nodes. No standalone Split/Combine node is created.
 */
export function insertAutoAdapter(
  nodes: Node[],
  _edges: Edge[],
  params: Connection,
  sourceType: DataType,
  targetType: DataType,
): AdapterResult {
  const sourceNode = nodes.find(node => node.id === params.source);
  const targetNode = nodes.find(node => node.id === params.target);
  if (!sourceNode || !targetNode) {
    console.error('Auto-Adapter: Source or target node not found', params);
    return emptyResult();
  }

  const resolvedTargetType = resolveTargetType(sourceType, targetType);
  const adapterType = detectAdapterType(sourceType, resolvedTargetType);
  if (!adapterType) return emptyResult();

  if (adapterType === 'combine') {
    const targetVectorType = resolvedTargetType as VectorType;
    return {
      newNodes: [],
      updatedNodes: [expandPort(targetNode, 'input', params.targetHandle)],
      newEdges: [componentEdge(
        params,
        params.sourceHandle,
        inlinePortHandleId('input', params.targetHandle, vectorComponents(targetVectorType)[0]),
        'x',
      )],
    };
  }

  if (adapterType === 'split') {
    const sourceVectorType = sourceType as VectorType;
    return {
      newNodes: [],
      updatedNodes: [expandPort(sourceNode, 'output', params.sourceHandle)],
      newEdges: [componentEdge(
        params,
        inlinePortHandleId('output', params.sourceHandle, vectorComponents(sourceVectorType)[0]),
        params.targetHandle,
        'x',
      )],
    };
  }

  const sourceVectorType = sourceType as VectorType;
  const targetVectorType = resolvedTargetType as VectorType;
  const sourceComponents = vectorComponents(sourceVectorType);
  const targetComponents = vectorComponents(targetVectorType);
  const commonComponents = sourceComponents.filter(component => targetComponents.includes(component));
  return {
    newNodes: [],
    updatedNodes: [
      expandPort(sourceNode, 'output', params.sourceHandle),
      expandPort(targetNode, 'input', params.targetHandle),
    ],
    newEdges: commonComponents.map(component => componentEdge(
      params,
      inlinePortHandleId('output', params.sourceHandle, component),
      inlinePortHandleId('input', params.targetHandle, component),
      component,
    )),
  };
}
