import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

const renderSampleBuffer = () => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: 'sample1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.sample_buffer, sampleWrap: 'repeat', offsetX: 0, offsetY: 0 },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>
);

describe('Sample Buffer node UI', () => {
  it('shows the resource, optional coordinates, editable pixel offsets and RGB output', async () => {
    const { container } = renderSampleBuffer();
    expect(await screen.findByText('SAMPLE BUFFER')).toBeInTheDocument();
    expect(screen.getByText('Buffer2D')).toBeInTheDocument();
    expect(screen.getByText('UV (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Offset X in pixels')).toHaveValue('0');
    expect(screen.getByLabelText('Offset Y in pixels')).toHaveValue('0');
    expect(container.querySelectorAll('.react-flow__handle')).toHaveLength(5);
  });

  it('switches wrap mode and accepts a temporary negative decimal draft without graph shortcuts', async () => {
    renderSampleBuffer();
    const repeat = await screen.findByTestId('sample-buffer-wrap-repeat');
    const clamp = screen.getByTestId('sample-buffer-wrap-clamp');
    expect(repeat).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(clamp);
    await waitFor(() => expect(clamp).toHaveAttribute('aria-pressed', 'true'));

    const offsetX = screen.getByLabelText('Offset X in pixels');
    fireEvent.change(offsetX, { target: { value: '-' } });
    expect(offsetX).toHaveValue('-');
    fireEvent.change(offsetX, { target: { value: '-1.5' } });
    fireEvent.keyDown(offsetX, { key: 'Enter' });
    expect(offsetX).toHaveValue('-1.5');
  });
});
