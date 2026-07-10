import type { GraphEdge, GraphNode } from './compiler';

export interface CompilerDebugReport {
  targetNodeId: string | null;
  isSubgraph: boolean;
  nodeCount: number;
  edgeCount: number;
  sortedNodeIds: string[];
  generatedCustomNodeIds: string[];
  skippedNodeIds: string[];
  finalLine: string;
  shaderLength: number;
}

export const buildCompilerDebugSummary = (report: CompilerDebugReport): string => {
  return [
    `target=${report.targetNodeId ?? 'null'}`,
    `subgraph=${report.isSubgraph}`,
    `nodes=${report.nodeCount}`,
    `edges=${report.edgeCount}`,
    `sorted=${report.sortedNodeIds.length}`,
    `customFunctions=${report.generatedCustomNodeIds.length}`,
    `skipped=${report.skippedNodeIds.length}`,
    `shaderLength=${report.shaderLength}`,
  ].join(' | ');
};

export const createCompilerDebugReport = ({
  nodes,
  edges,
  sortedNodes,
  generatedCustomNodeIds,
  skippedNodeIds,
  targetNodeId,
  isSubgraph,
  finalLine,
  shaderLength,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sortedNodes: GraphNode[];
  generatedCustomNodeIds: Iterable<string>;
  skippedNodeIds: Iterable<string>;
  targetNodeId?: string;
  isSubgraph: boolean;
  finalLine: string;
  shaderLength: number;
}): CompilerDebugReport => ({
  targetNodeId: targetNodeId ?? null,
  isSubgraph,
  nodeCount: nodes.length,
  edgeCount: edges.length,
  sortedNodeIds: sortedNodes.map(node => node.id),
  generatedCustomNodeIds: [...generatedCustomNodeIds],
  skippedNodeIds: [...skippedNodeIds],
  finalLine,
  shaderLength,
});
