import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

vi.mock('../components/ShaderPreview', () => ({
  default: () => <div data-testid="mock-buffer-shader-preview">buffer canvas</div>,
}));

const renderFrameBuffer = (captureMode: 'snapshot' | 'last-frame' = 'snapshot') => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: 'buffer1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.feedback, captureMode },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>
);

describe('Frame Buffer node preview', () => {
  it('makes Snapshot and Last Frame explicit, switchable modes', async () => {
    const { container } = renderFrameBuffer();
    const snapshot = await screen.findByTestId('frame-buffer-mode-snapshot');
    const lastFrame = screen.getByTestId('frame-buffer-mode-last-frame');

    expect(snapshot).toHaveAttribute('aria-pressed', 'true');
    expect(lastFrame).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Stores once when Snapshot fires.')).toBeInTheDocument();

    fireEvent.click(lastFrame);

    await waitFor(() => expect(lastFrame).toHaveAttribute('aria-pressed', 'true'));
    expect(snapshot).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Stores automatically; output is exactly 1 frame old.')).toBeInTheDocument();
    expect(container.querySelector('.react-flow__handle[title="Snapshot is ignored in LAST FRAME mode"]'))
      .toBeInTheDocument();
  });

  it('keeps the WebGL preview unmounted until the user opens it', async () => {
    const { container } = renderFrameBuffer();

    const openButton = await screen.findByTestId('frame-buffer-preview-toggle');
    expect(openButton).toHaveAttribute('aria-label', 'Show buffer preview');
    expect(screen.queryByTestId('frame-buffer-preview-window')).not.toBeInTheDocument();
    expect(container.querySelector('.react-flow__handle[title*="latch every interval boundary"]'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('mock-buffer-shader-preview')).not.toBeInTheDocument();

    fireEvent.click(openButton);
    expect(await screen.findByTestId('frame-buffer-preview-window')).toBeInTheDocument();
    expect(await screen.findByTestId('mock-buffer-shader-preview')).toBeInTheDocument();
    expect(screen.getByTestId('frame-buffer-preview-toggle')).toHaveAttribute('aria-label', 'Hide buffer preview');
  });

  it('closes and unmounts the preview while keeping all Frame Buffer ports', async () => {
    const { container } = renderFrameBuffer();
    fireEvent.click(await screen.findByTestId('frame-buffer-preview-toggle'));
    await screen.findByTestId('mock-buffer-shader-preview');
    fireEvent.click(screen.getByTestId('frame-buffer-preview-toggle'));

    await waitFor(() => expect(screen.queryByTestId('mock-buffer-shader-preview')).not.toBeInTheDocument());
    expect(screen.getByText('Image In')).toBeInTheDocument();
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Sample UV (Advanced)')).toBeInTheDocument();
    expect(screen.getByText('Stored Image')).toBeInTheDocument();
    expect(container.querySelectorAll('.react-flow__handle')).toHaveLength(4);
  });
});
