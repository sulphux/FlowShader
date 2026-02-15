import type { Node, Edge } from 'reactflow';
import type { DataType } from './types';
import { NODE_REGISTRY } from '../nodes';

// ============================================================================
// TYPES
// ============================================================================

interface Connection {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

interface AdapterResult {
  newNodes: Node[];
  newEdges: Edge[];
}

type AdapterType = 'combine' | 'split' | 'split-combine' | null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate midpoint between two nodes
 */
function calculateMidpoint(nodeA: Node, nodeB: Node): { x: number; y: number } {
  return {
    x: (nodeA.position.x + nodeB.position.x) / 2,
    y: (nodeA.position.y + nodeB.position.y) / 2
  };
}

/**
 * Generate unique ID for adapter node
 */
function generateAdapterId(type: string): string {
  return `${type}_adapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create adapter node (Split or Combine)
 */
function createAdapterNode(
  type: string, // 'split_vec3', 'combine_vec2', etc.
  position: { x: number; y: number }
): Node {
  const nodeType = type; // e.g., 'split_vec3'
  const definition = NODE_REGISTRY[nodeType];

  if (!definition) {
    throw new Error(`Adapter node type "${nodeType}" not found in NODE_REGISTRY`);
  }

  return {
    id: generateAdapterId(type),
    type: 'shaderNode',
    position,
    data: {
      definition,
      value: undefined
    }
  };
}

/**
 * Get component ports for vector type
 */
function getComponentPorts(vecType: 'vec2' | 'vec3' | 'vec4'): string[] {
  const ports: Record<string, string[]> = {
    vec2: ['x', 'y'],
    vec3: ['x', 'y', 'z'],
    vec4: ['x', 'y', 'z', 'w']
  };
  return ports[vecType] || [];
}

/**
 * Detect which adapter type is needed
 */
function detectAdapterType(sourceType: DataType, targetType: DataType): AdapterType {
  // float → vec (requires Combine)
  if (sourceType === 'float' && ['vec2', 'vec3', 'vec4'].includes(targetType)) {
    return 'combine';
  }

  // vec → float (requires Split)
  if (['vec2', 'vec3', 'vec4'].includes(sourceType) && targetType === 'float') {
    return 'split';
  }

  // vec → different vec (requires Split + Combine)
  if (
    ['vec2', 'vec3', 'vec4'].includes(sourceType) &&
    ['vec2', 'vec3', 'vec4'].includes(targetType) &&
    sourceType !== targetType
  ) {
    return 'split-combine';
  }

  return null;
}

// ============================================================================
// CORE ADAPTER FUNCTIONS
// ============================================================================

/**
 * Insert Combine node for float → vec conversion
 * Example: float → vec3 creates Combine Vec3, connects float to .x input
 */
function insertCombineNode(
  nodes: Node[],
  edges: Edge[],
  sourceNode: Node,
  targetNode: Node,
  targetType: 'vec2' | 'vec3' | 'vec4',
  params: Connection
): AdapterResult {
  const midpoint = calculateMidpoint(sourceNode, targetNode);
  const combineNode = createAdapterNode(`combine_${targetType}`, midpoint);

  // Edge 1: source → combine.x
  const edge1: Edge = {
    id: `${params.source}_${combineNode.id}_x`,
    source: params.source,
    sourceHandle: params.sourceHandle,
    target: combineNode.id,
    targetHandle: 'x' // float connects to first component
  };

  // Edge 2: combine.out → target
  const edge2: Edge = {
    id: `${combineNode.id}_${params.target}`,
    source: combineNode.id,
    sourceHandle: 'result',
    target: params.target,
    targetHandle: params.targetHandle
  };

  return {
    newNodes: [combineNode],
    newEdges: [edge1, edge2]
  };
}

/**
 * Insert Split node for vec → float conversion
 * Example: vec3 → float creates Split Vec3, connects .x output to target
 */
function insertSplitNode(
  nodes: Node[],
  edges: Edge[],
  sourceNode: Node,
  targetNode: Node,
  sourceType: 'vec2' | 'vec3' | 'vec4',
  params: Connection
): AdapterResult {
  const midpoint = calculateMidpoint(sourceNode, targetNode);
  const splitNode = createAdapterNode(`split_${sourceType}`, midpoint);

  // Edge 1: source → split.in
  const edge1: Edge = {
    id: `${params.source}_${splitNode.id}`,
    source: params.source,
    sourceHandle: params.sourceHandle,
    target: splitNode.id,
    targetHandle: 'in'
  };

  // Edge 2: split.x → target (default to .x component)
  const edge2: Edge = {
    id: `${splitNode.id}_${params.target}`,
    source: splitNode.id,
    sourceHandle: 'x',
    target: params.target,
    targetHandle: params.targetHandle
  };

  return {
    newNodes: [splitNode],
    newEdges: [edge1, edge2]
  };
}

/**
 * Insert Split + Combine for vec → different vec conversion
 * Example: vec2 → vec3 creates Split Vec2 and Combine Vec3
 */
function insertSplitAndCombine(
  nodes: Node[],
  edges: Edge[],
  sourceNode: Node,
  targetNode: Node,
  sourceType: 'vec2' | 'vec3' | 'vec4',
  targetType: 'vec2' | 'vec3' | 'vec4',
  params: Connection
): AdapterResult {
  const midpoint = calculateMidpoint(sourceNode, targetNode);

  // Split on left, Combine on right
  const splitNode = createAdapterNode(`split_${sourceType}`, {
    x: midpoint.x - 100,
    y: midpoint.y
  });

  const combineNode = createAdapterNode(`combine_${targetType}`, {
    x: midpoint.x + 100,
    y: midpoint.y
  });

  const newEdges: Edge[] = [];

  // Edge 1: source → split.in
  newEdges.push({
    id: `${params.source}_${splitNode.id}`,
    source: params.source,
    sourceHandle: params.sourceHandle,
    target: splitNode.id,
    targetHandle: 'in'
  });

  // Connect matching components (x→x, y→y, z→z if exist)
  const sourceComponents = getComponentPorts(sourceType);
  const targetComponents = getComponentPorts(targetType);
  const commonComponents = sourceComponents.filter(c => targetComponents.includes(c));

  commonComponents.forEach(component => {
    newEdges.push({
      id: `${splitNode.id}_${combineNode.id}_${component}`,
      source: splitNode.id,
      sourceHandle: component,
      target: combineNode.id,
      targetHandle: component
    });
  });

  // Edge N: combine.out → target
  newEdges.push({
    id: `${combineNode.id}_${params.target}`,
    source: combineNode.id,
    sourceHandle: 'result',
    target: params.target,
    targetHandle: params.targetHandle
  });

  return {
    newNodes: [splitNode, combineNode],
    newEdges
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Auto-Adapter System - Main Entry Point
 * 
 * Automatically inserts Split/Combine nodes when user attempts incompatible connection.
 * 
 * Examples:
 * - float → vec3: Inserts Combine Vec3, connects float to .x
 * - vec3 → float: Inserts Split Vec3, connects .x to target
 * - vec2 → vec3: Inserts Split Vec2 + Combine Vec3, maps x→x, y→y
 * 
 * @param nodes - Current graph nodes
 * @param edges - Current graph edges
 * @param params - Connection attempt parameters (source, target, handles)
 * @param sourceType - Source port type (e.g., 'float', 'vec3')
 * @param targetType - Target port type (e.g., 'vec3', 'float')
 * @returns New nodes and edges to add to graph
 */
export function insertAutoAdapter(
  nodes: Node[],
  edges: Edge[],
  params: Connection,
  sourceType: DataType,
  targetType: DataType
): AdapterResult {
  // Find source and target nodes
  const sourceNode = nodes.find(n => n.id === params.source);
  const targetNode = nodes.find(n => n.id === params.target);

  if (!sourceNode || !targetNode) {
    console.error('Auto-Adapter: Source or target node not found', params);
    return { newNodes: [], newEdges: [] };
  }

  // Detect which adapter is needed
  const adapterType = detectAdapterType(sourceType, targetType);

  if (!adapterType) {
    console.warn('Auto-Adapter: No adapter needed or unsupported conversion', {
      sourceType,
      targetType
    });
    return { newNodes: [], newEdges: [] };
  }

  // Insert appropriate adapter(s)
  switch (adapterType) {
    case 'combine':
      return insertCombineNode(
        nodes,
        edges,
        sourceNode,
        targetNode,
        targetType as 'vec2' | 'vec3' | 'vec4',
        params
      );

    case 'split':
      return insertSplitNode(
        nodes,
        edges,
        sourceNode,
        targetNode,
        sourceType as 'vec2' | 'vec3' | 'vec4',
        params
      );

    case 'split-combine':
      return insertSplitAndCombine(
        nodes,
        edges,
        sourceNode,
        targetNode,
        sourceType as 'vec2' | 'vec3' | 'vec4',
        targetType as 'vec2' | 'vec3' | 'vec4',
        params
      );

    default:
      return { newNodes: [], newEdges: [] };
  }
}
