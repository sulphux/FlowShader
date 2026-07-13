const MIN_INTERVAL_SECONDS = 0.001;
const EVENT_TOKEN_OFFSET = 2;

export const safeImpulseInterval = (interval: number): number =>
  Math.max(Number.isFinite(interval) ? interval : 1, MIN_INTERVAL_SECONDS);

export const isImpulsePulseActive = (time: number, interval: number, width: number): boolean => {
  const safeInterval = safeImpulseInterval(interval);
  return (Math.max(time, 0) % safeInterval) < safeInterval * width;
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
