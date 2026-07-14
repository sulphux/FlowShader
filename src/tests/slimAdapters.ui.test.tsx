import { describe, it, expect } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';
import type { ShaderNodeDefinition } from '../core/types';
import { inlinePortHandleId } from '../core/inlinePortAdapters';

/**
 * Regresja: Combine (Vec4) renderował się jako ogromny node z pełną listą portów.
 * Combinery/splittery mają być smukłe: symbol (≻/≺) + badge rozmiaru,
 * nazwa w tooltipie (hover), porty podpisane przez title na handle'ach.
 */

const renderNode = (definition: ShaderNodeDefinition) => {
  return render(
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[{
          id: 'n1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: { definition },
        }]}
        nodeTypes={{ shaderNode: ShaderNode }}
      />
    </ReactFlowProvider>
  );
};

const getSlimRoot = (container: HTMLElement) =>
  container.querySelector('.react-flow__node [title]') as HTMLElement;

describe('Slim Combine/Split adapters', () => {
  it('combine_vec4 renders slim with ≻ symbol, size badge and tooltip name', async () => {
    const { container } = renderNode(NODE_REGISTRY.combine_vec4);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const root = getSlimRoot(container);
    expect(root.getAttribute('title')).toContain('Combine (Vec4)');
    expect(root.style.width).toBe('76px');
    expect(root.textContent).toContain('≻');
    expect(root.textContent).toContain('4');
    expect([...container.querySelectorAll('[data-port-label]')].map(element => element.getAttribute('data-port-label')))
      .toEqual(['R', 'G', 'B', 'A', 'Vec4']);

    // 4 wejścia + 1 wyjście
    expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(4);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(1);
  });

  it('split_vec3 renders slim with ≺ symbol and 3 outputs', async () => {
    const { container } = renderNode(NODE_REGISTRY.split_vec3);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const root = getSlimRoot(container);
    expect(root.getAttribute('title')).toContain('Split (Vec3)');
    expect(root.style.width).toBe('76px');
    expect(root.textContent).toContain('≺');
    expect(root.textContent).toContain('3');

    expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(1);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(3);
  });

  it('port labels are exposed as handle tooltips', async () => {
    const { container } = renderNode(NODE_REGISTRY.combine_vec4);
    await waitFor(() => expect(container.querySelectorAll('.react-flow__handle').length).toBe(5));

    const targetTitles = [...container.querySelectorAll('.react-flow__handle.target')]
      .map(h => h.getAttribute('title'));
    expect(targetTitles).toEqual(['R · float', 'G · float', 'B · float', 'A · float']);
  });

  it('smart_split (auto) also renders slim with A badge before adaptation', async () => {
    const { container } = renderNode(NODE_REGISTRY.smart_split);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const root = getSlimRoot(container);
    expect(root.textContent).toContain('≺');
    expect(root.textContent).toContain('A');
  });

  it('smart_compose starts undetermined (auto) and cycles vec2 → vec3 → vec4 on click', async () => {
    // Regression: Combine (Auto) used to default straight to a concrete vec3
    // (flat yellow port), unlike Split (Auto) which starts as 'auto' (rainbow)
    // until adapted/chosen — inconsistent and misleading. Both now start 'auto'.
    const { container } = renderNode(NODE_REGISTRY.smart_compose);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const badge = () => [...container.querySelectorAll('span')]
      .find(s => /^[234A]$/.test(s.textContent || '')) as HTMLElement;

    expect(badge().textContent).toBe('A'); // niewybrany, jak Split (Auto)

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('2'));

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('3'));

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('4'));
  });

  it('splits the selected Smart Combine vector output from its context menu', async () => {
    const { container, getByRole } = renderNode(NODE_REGISTRY.smart_compose);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());
    const badge = () => [...container.querySelectorAll('span')]
      .find(span => /^[1234A]$/.test(span.textContent || '')) as HTMLElement;

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('2'));
    fireEvent.contextMenu(container.querySelector('[data-handleid="out"]')!);
    fireEvent.click(getByRole('menuitem', { name: '⑂ Split into X / Y' }));

    await waitFor(() => {
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'out', 'x')}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('output', 'out', 'y')}"]`)).toBeTruthy();
    });
  });

  it('splits the selected Smart Split vector input from its context menu', async () => {
    const { container, getByRole } = renderNode(NODE_REGISTRY.smart_split);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());
    const badge = () => [...container.querySelectorAll('span')]
      .find(span => /^[1234A]$/.test(span.textContent || '')) as HTMLElement;

    fireEvent.click(badge()); // float
    await waitFor(() => expect(badge().textContent).toBe('1'));
    fireEvent.click(badge()); // vec2
    await waitFor(() => expect(badge().textContent).toBe('2'));
    fireEvent.contextMenu(container.querySelector('[data-handleid="in"]')!);
    fireEvent.click(getByRole('menuitem', { name: '⑂ Split into X / Y' }));

    await waitFor(() => {
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'in', 'x')}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-handleid="${inlinePortHandleId('input', 'in', 'y')}"]`)).toBeTruthy();
    });
  });

  it('smart_compose is user-facing labeled "Combine (Auto)" (naming audit)', () => {
    expect(NODE_REGISTRY.smart_compose.label).toBe('Combine (Auto)');
  });
});
