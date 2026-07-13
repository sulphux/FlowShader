import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

const renderImpulse = () => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: 'impulse1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.impulse },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>
);

describe('Impulse node UI', () => {
  it('uses the explanatory full-size layout instead of the compact pill', async () => {
    const { container } = renderImpulse();

    await waitFor(() => expect(screen.getByText('seconds between pulses')).toBeInTheDocument());
    expect(screen.getByText('on-time fraction · 0–1')).toBeInTheDocument();
    expect(screen.getByText('Event · IMPULSE')).toBeInTheDocument();
    expect(NODE_REGISTRY.impulse.compact).not.toBe(true);

    const handles = [...container.querySelectorAll('.react-flow__handle')];
    expect(handles).toHaveLength(3);
    handles.forEach(handle => expect(handle).not.toHaveClass('handle-inline'));
  });

  it('lights the PULSE LED only during the active part of each interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      renderImpulse();
      const led = screen.getByTestId('impulse-led');
      expect(led).toHaveAttribute('data-active', 'true');

      await act(() => vi.advanceTimersByTimeAsync(100));
      expect(led).toHaveAttribute('data-active', 'false');

      await act(() => vi.advanceTimersByTimeAsync(912));
      expect(led).toHaveAttribute('data-active', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});
