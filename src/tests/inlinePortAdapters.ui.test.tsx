import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { inlinePortHandleId } from '../core/inlinePortAdapters';
import { NODE_REGISTRY } from '../nodes';

function renderDefinition(definition: typeof NODE_REGISTRY.uv) {
  return render(
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[{ id: 'n1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition } }]}
        nodeTypes={{ shaderNode: ShaderNode }}
      />
    </ReactFlowProvider>,
  );
}

describe('inline vector pin adapters', () => {
  it('expands a compact vec2 output into local X/Y float handles', async () => {
    const { container, getByRole } = renderDefinition(NODE_REGISTRY.uv);
    const output = container.querySelector('[data-handleid="out"]');
    expect(output).toBeTruthy();
    fireEvent.contextMenu(output!);
    fireEvent.click(getByRole('menuitem', { name: '⑂ Split into X / Y' }));

    await waitFor(() => expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(2));
    expect(container.querySelector('[data-handleid="out"]')).toBeFalsy();
    expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'out', 'x')}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'out', 'y')}"]`)).toBeTruthy();
  });

  it('labels compact ports and keeps them readable when only one Add Vec2 input is split', async () => {
    const { container, getByRole } = renderDefinition(NODE_REGISTRY.vec_add2 as typeof NODE_REGISTRY.uv);
    expect([...container.querySelectorAll('[data-port-label]')].map(element => element.getAttribute('data-port-label')))
      .toEqual(['A', 'B', 'Sum']);

    fireEvent.contextMenu(container.querySelector('[data-handleid="a"]')!);
    fireEvent.click(getByRole('menuitem', { name: '⑂ Split into X / Y' }));

    await waitFor(() => {
      expect(container.querySelector('[data-handleid="a"]')).toBeFalsy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'a', 'x')}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'a', 'y')}"]`)).toBeTruthy();
    });
    expect([...container.querySelectorAll('[data-port-label]')].map(element => element.getAttribute('data-port-label')))
      .toEqual(['A.X', 'A.Y', 'B', 'Sum']);
    expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(3);
  });

  it('expands a regular vec2 input into local X/Y float handles', async () => {
    const { container } = renderDefinition(NODE_REGISTRY.sdf_circle);
    const expand = container.querySelector('button[aria-label="Expand UV vec2 components"]');
    expect(expand).toBeTruthy();
    fireEvent.click(expand!);

    await waitFor(() => expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(3));
    expect(container.querySelector('[data-handleid="uv"]')).toBeFalsy();
    expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'uv', 'x')}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'uv', 'y')}"]`)).toBeTruthy();
  });

  it('is available on the expression Code node', async () => {
    const definition = {
      ...NODE_REGISTRY.code_glsl,
      inputs: [{ id: 'a', label: 'a', type: 'vec3' }],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
    } as typeof NODE_REGISTRY.uv;
    const { container } = renderDefinition(definition);

    fireEvent.click(container.querySelector('button[aria-label="Expand a vec3 components"]')!);
    fireEvent.click(container.querySelector('button[aria-label="Expand Out vec3 components"]')!);

    await waitFor(() => {
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'a', 'z')}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'out', 'z')}"]`)).toBeTruthy();
    });
  });

  it('is available on dynamic Code Block ports', async () => {
    const definition = {
      ...NODE_REGISTRY.code_block,
      inputs: [{ id: 'point', label: 'point', type: 'vec3' }],
      outputs: [{ id: 'normal', label: 'normal', type: 'vec3' }],
    } as typeof NODE_REGISTRY.uv;
    const { container } = renderDefinition(definition);

    fireEvent.click(container.querySelector('button[aria-label="Expand point vec3 components"]')!);
    fireEvent.click(container.querySelector('button[aria-label="Expand normal vec3 components"]')!);

    await waitFor(() => {
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'point', 'x')}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'normal', 'z')}"]`)).toBeTruthy();
    });
  });
});
