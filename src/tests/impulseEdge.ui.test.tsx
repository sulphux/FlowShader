import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Position, ReactFlowProvider } from 'reactflow';
import { ImpulseEdge } from '../components/ImpulseEdge';

vi.mock('../core/runtimeClock', () => ({
  getRuntimeTimeSeconds: () => Date.now() * 0.001,
}));

describe('ImpulseEdge', () => {
  it('shows one visible travelling event per cycle, including sub-frame pulses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      render(
        <ReactFlowProvider>
          <svg>
            <ImpulseEdge
              id="edge"
              source="impulse"
              target="buffer"
              sourceX={0}
              sourceY={0}
              targetX={200}
              targetY={0}
              sourcePosition={Position.Right}
              targetPosition={Position.Left}
            />
          </svg>
        </ReactFlowProvider>,
      );

      expect(screen.getByTestId('impulse-edge-event')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(150));
      expect(screen.queryByTestId('impulse-edge-event')).not.toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(858));
      expect(screen.getByTestId('impulse-edge-event')).toBeInTheDocument();

      // Default shader pulse is only 50 ms, but the visual marker remains
      // legible for the UI minimum of 140 ms.
      await act(() => vi.advanceTimersByTimeAsync(100));
      expect(screen.getByTestId('impulse-edge-event')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(50));
      expect(screen.queryByTestId('impulse-edge-event')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
