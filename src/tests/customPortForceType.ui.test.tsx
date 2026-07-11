import { describe, it, expect } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

/**
 * FORCE TYPE buttons on Custom Input/Output: let the user pin a port's type
 * instead of relying purely on auto-detection from whatever gets connected.
 */

const renderNode = (defId: 'custom_input' | 'custom_output', data: Record<string, unknown> = {}) => {
  return render(
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[{
          id: 'n1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: { definition: NODE_REGISTRY[defId], label: defId === 'custom_input' ? 'Input' : 'Output', ...data },
        }]}
        nodeTypes={{ shaderNode: ShaderNode }}
      />
    </ReactFlowProvider>
  );
};

describe('Custom Input/Output — FORCE TYPE buttons', () => {
  it('renders float/vec2/vec3/vec4 buttons, none active by default', async () => {
    const { container } = renderNode('custom_input');
    await waitFor(() => expect(container.querySelectorAll('button').length).toBeGreaterThan(0));

    const labels = [...container.querySelectorAll('button')].map(b => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(['1', '2', '3', '4']));
    expect(container.querySelector('button')?.parentElement?.textContent).not.toContain('AUTO');
  });

  it('clicking VEC3 sets forcedType and updates the output port type immediately', async () => {
    const { container } = renderNode('custom_input');
    await waitFor(() => expect(container.querySelectorAll('button').length).toBeGreaterThan(0));

    const vec3Btn = [...container.querySelectorAll('button')].find(b => b.textContent === '3')!;
    fireEvent.click(vec3Btn);

    await waitFor(() => {
      const handle = container.querySelector('.react-flow__handle.source');
      expect(handle).toHaveAttribute('data-handleid', 'out');
    });
    // AUTO (clear) button appears once something is forced
    await waitFor(() => {
      expect([...container.querySelectorAll('button')].some(b => b.textContent === 'AUTO')).toBe(true);
    });
  });

  it('clicking AUTO clears the forced type', async () => {
    const { container } = renderNode('custom_output', { forcedType: 'vec2' });
    await waitFor(() => {
      expect([...container.querySelectorAll('button')].some(b => b.textContent === 'AUTO')).toBe(true);
    });

    const autoBtn = [...container.querySelectorAll('button')].find(b => b.textContent === 'AUTO')!;
    fireEvent.click(autoBtn);

    await waitFor(() => {
      expect([...container.querySelectorAll('button')].some(b => b.textContent === 'AUTO')).toBe(false);
    });
  });

  it('force-type buttons do not render on unrelated nodes', async () => {
    const { container } = render(
      <ReactFlowProvider>
        <ReactFlow
          defaultNodes={[{ id: 'n1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY.math_add } }]}
          nodeTypes={{ shaderNode: ShaderNode }}
        />
      </ReactFlowProvider>
    );
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(1));
    expect([...container.querySelectorAll('button')].some(b => b.textContent === 'AUTO' || /^[1234]$/.test(b.textContent || ''))).toBe(false);
  });
});
