export type FrameBufferMode = 'snapshot' | 'last-frame';

interface FrameBufferNodeLike {
  id: string;
  data?: {
    captureMode?: unknown;
  };
}

interface FrameBufferEdgeLike {
  target: string;
  targetHandle?: string | null;
}

/**
 * Older saves did not store a mode. Preserve their behaviour while making
 * every newly edited/saved Frame Buffer explicit:
 * - a connected Snapshot port meant edge-triggered snapshots;
 * - a disconnected Snapshot port meant continuous previous-frame capture.
 */
export function resolveFrameBufferMode(
  node: FrameBufferNodeLike,
  edges: readonly FrameBufferEdgeLike[],
): FrameBufferMode {
  if (node.data?.captureMode === 'snapshot' || node.data?.captureMode === 'last-frame') {
    return node.data.captureMode;
  }

  return edges.some(edge => edge.target === node.id && edge.targetHandle === 'impulse')
    ? 'snapshot'
    : 'last-frame';
}
