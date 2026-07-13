const MIN_INTERVAL_SECONDS = 0.001;
const EVENT_TOKEN_OFFSET = 2;

export const safeImpulseInterval = (interval: number): number =>
  Math.max(Number.isFinite(interval) ? interval : 1, MIN_INTERVAL_SECONDS);

export const isImpulsePulseActive = (time: number, interval: number, width: number): boolean => {
  const safeInterval = safeImpulseInterval(interval);
  const safeWidth = Math.min(Math.max(Number.isFinite(width) ? width : 0.05, 0), 1);
  return (Math.max(time, 0) % safeInterval) < safeInterval * safeWidth;
};

export const impulseCycleAtTime = (time: number, interval: number): number =>
  Math.floor(Math.max(time, 0) / safeImpulseInterval(interval));

interface TimingNode {
  id: string;
  data?: unknown;
}

interface TimingEdge {
  source: string;
  target: string;
  targetHandle?: string | null;
}

export interface ResolvedImpulseTiming {
  interval: number;
  width: number;
  intervalDriven: boolean;
  widthDriven: boolean;
  intervalResolved: boolean;
  widthResolved: boolean;
}

/** Resolve values that the node UI can know without evaluating arbitrary GLSL. */
export const resolveImpulseTiming = (
  impulseNodeId: string,
  nodes: TimingNode[],
  edges: TimingEdge[],
): ResolvedImpulseTiming => {
  const readFloatInput = (handle: 'interval' | 'width', fallback: number) => {
    const edge = edges.find(candidate => candidate.target === impulseNodeId && candidate.targetHandle === handle);
    if (!edge) return { value: fallback, driven: false, resolved: true };
    const source = nodes.find(candidate => candidate.id === edge.source);
    const sourceData = source?.data as {
      value?: unknown;
      definition?: { id?: string; controls?: { defaultValue?: unknown } };
    } | undefined;
    if (sourceData?.definition?.id === 'param_float') {
      const parsed = Number(sourceData.value ?? sourceData.definition.controls?.defaultValue);
      if (Number.isFinite(parsed)) return { value: parsed, driven: true, resolved: true };
    }
    return { value: fallback, driven: true, resolved: false };
  };

  const intervalInput = readFloatInput('interval', 1);
  const widthInput = readFloatInput('width', 0.05);
  return {
    interval: safeImpulseInterval(intervalInput.value),
    width: Math.min(Math.max(widthInput.value, 0), 1),
    intervalDriven: intervalInput.driven,
    widthDriven: widthInput.driven,
    intervalResolved: intervalInput.resolved,
    widthResolved: widthInput.resolved,
  };
};

/**
 * A persistent event id used by Frame Buffer writers. Unlike a short 0/1
 * pulse, this value remains unchanged for the whole interval, so a render
 * frame cannot miss the event boundary. The offset distinguishes the token
 * from an ordinary manual Snapshot gate, which stays in the 0..1 range.
 */
export const impulseEventTokenAtTime = (time: number, interval: number): number =>
  EVENT_TOKEN_OFFSET + Math.floor(Math.max(time, 0) / safeImpulseInterval(interval));

export const buildImpulseEventTokenGLSL = (intervalExpression = '1.0'): string =>
  `(${EVENT_TOKEN_OFFSET}.0 + floor(iTime / max(${intervalExpression}, ${MIN_INTERVAL_SECONDS.toFixed(3)})))`;
