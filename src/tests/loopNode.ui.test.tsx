import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { saveCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';

const step: CustomNodeDefinition = {
  id: 'custom_test_step',
  label: 'Test Step',
  isCustom: true,
  inputs: [
    { id: 'state', label: 'State', type: 'vec3' },
    { id: 'index', label: 'Index', type: 'float' },
    { id: 'progress', label: 'Progress', type: 'float' },
  ],
  outputs: [{ id: 'next', label: 'Next State', type: 'vec3' }],
  subgraph: { nodes: [], edges: [] },
  glslTemplate: () => 'vec3(0.0)',
};

const renderLoop = () => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: 'loop', type: 'shaderNode', position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.loop_iterate, iterations: 16 },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>,
);

describe('Loop / Iterate UI', () => {
  beforeEach(() => {
    localStorage.clear();
    saveCustomNodes([step]);
  });

  it('selects a compatible visual Step and adapts state handles', async () => {
    const { container } = renderLoop();
    const selector = await screen.findByDisplayValue('— choose Step —');
    fireEvent.change(selector, { target: { value: step.id } });

    await waitFor(() => expect(screen.getByText('Step:', { exact: false })).toHaveTextContent('vec3 State'));
    expect(container.querySelector('.react-flow__handle.target[data-handleid="initial"]')).toHaveAttribute('title', 'Initial State · vec3');
  });

  it('allows clearing and replacing the iteration count without leaking keyboard shortcuts', async () => {
    renderLoop();
    const input = await screen.findByLabelText('Loop iterations');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '32' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('32');
  });
});
