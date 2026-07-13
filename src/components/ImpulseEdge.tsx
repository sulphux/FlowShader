import { memo, useEffect, useMemo, useState } from 'react';
import {
  BaseEdge,
  getBezierPath,
  useEdges,
  useNodes,
  type EdgeProps,
} from 'reactflow';
import { TYPE_COLORS } from '../core/theme';
import { getRuntimeTimeSeconds } from '../core/runtimeClock';
import { impulseCycleAtTime, isImpulsePulseActive, resolveImpulseTiming } from '../core/impulseTiming';

/**
 * Event-aware edge: one bright packet travels down the wire for every event.
 * The UI packet has a minimum visible duration, while the shader and Frame
 * Buffer keep the exact (possibly sub-frame) timing.
 */
export const ImpulseEdge = memo(({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
}: EdgeProps) => {
  const nodes = useNodes();
  const edges = useEdges();
  const timing = useMemo(
    () => resolveImpulseTiming(source, nodes, edges),
    [source, nodes, edges],
  );
  const [pulseSequence, setPulseSequence] = useState(0);
  const [visuallyActive, setVisuallyActive] = useState(false);
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const visibleDuration = Math.max(0.14, Math.min(0.6, timing.interval * timing.width));

  useEffect(() => {
    let previousCycle = impulseCycleAtTime(getRuntimeTimeSeconds(), timing.interval);
    let offTimer: number | undefined;

    const showEvent = () => {
      setPulseSequence(sequence => sequence + 1);
      setVisuallyActive(true);
      if (offTimer !== undefined) window.clearTimeout(offTimer);
      offTimer = window.setTimeout(() => setVisuallyActive(false), visibleDuration * 1000);
    };

    const tick = () => {
      const nextCycle = impulseCycleAtTime(getRuntimeTimeSeconds(), timing.interval);
      if (nextCycle !== previousCycle) {
        previousCycle = nextCycle;
        showEvent();
      }
    };

    if (isImpulsePulseActive(getRuntimeTimeSeconds(), timing.interval, timing.width)) showEvent();
    const timer = window.setInterval(tick, 16);
    return () => {
      window.clearInterval(timer);
      if (offTimer !== undefined) window.clearTimeout(offTimer);
    };
  }, [timing.interval, timing.width, visibleDuration]);

  const wireStyle = {
    ...style,
    stroke: TYPE_COLORS.impulse,
    strokeWidth: 3,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={wireStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {visuallyActive && (
        <g data-testid="impulse-edge-event" pointerEvents="none">
          <path
            d={edgePath}
            fill="none"
            stroke={TYPE_COLORS.impulse}
            strokeWidth="7"
            opacity="0.28"
            style={{ filter: `drop-shadow(0 0 4px ${TYPE_COLORS.impulse})` }}
          />
          <circle key={pulseSequence} r="4.5" fill="#e1f5fe" stroke={TYPE_COLORS.impulse} strokeWidth="2">
            <animateMotion path={edgePath} dur={`${visibleDuration}s`} fill="freeze" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.82;1" dur={`${visibleDuration}s`} fill="freeze" />
          </circle>
        </g>
      )}
    </>
  );
});

ImpulseEdge.displayName = 'ImpulseEdge';
