import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

const renderCodeBlock = () => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: 'block',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY.code_block,
          label: 'Code Block (GLSL)',
          value: 'return length(p);',
        },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>,
);

describe('Code Block dynamic port UI', () => {
  it('shows the callable GLSL signature derived from the title and ports', async () => {
    renderCodeBlock();
    const title = await screen.findByDisplayValue('Code Block (GLSL)');
    fireEvent.change(title, { target: { value: 'Map' } });

    await waitFor(() => expect(screen.getByTestId('code-block-signature'))
      .toHaveTextContent('In other Code Blocks: float map(vec3 p)'));
  });

  it('adds, renames and types input/output ports', async () => {
    const { container } = renderCodeBlock();
    await waitFor(() => expect(screen.getByDisplayValue('return length(p);')).toBeInTheDocument());

    expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(1);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(1);

    const addButtons = screen.getAllByText('+');
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(2);
      expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(2);
    });

    const names = screen.getAllByTitle('GLSL variable name');
    fireEvent.change(names[0], { target: { value: 'position' } });
    fireEvent.blur(names[0]);
    await waitFor(() => expect(screen.getByDisplayValue('position')).toBeInTheDocument());
    expect(container.querySelector('.react-flow__handle.target[data-handleid="position"]')).toBeTruthy();

    const typeSelectors = container.querySelectorAll('select');
    fireEvent.change(typeSelectors[typeSelectors.length - 1], { target: { value: 'vec3' } });
    await waitFor(() => expect((typeSelectors[typeSelectors.length - 1] as HTMLSelectElement).value).toBe('vec3'));
  });

  it('keeps Shift+/ inside the editor and preserves question marks', async () => {
    renderCodeBlock();
    const editor = await screen.findByDisplayValue('return length(p);');
    const leakedKey = vi.fn();
    window.addEventListener('keydown', leakedKey);

    fireEvent.keyDown(editor, { key: '?', code: 'Slash', shiftKey: true });
    expect(leakedKey).not.toHaveBeenCalled();

    fireEvent.change(editor, { target: { value: 'return p.x > 0.0 ? 1.0 : 0.0;' } });
    expect(screen.getByDisplayValue('return p.x > 0.0 ? 1.0 : 0.0;')).toBeInTheDocument();
    window.removeEventListener('keydown', leakedKey);
  });
});
