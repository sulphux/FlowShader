import { describe, it, expect } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';
import type { ShaderNodeDefinition } from '../core/types';

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
    expect(root.style.width).toBe('36px');
    expect(root.textContent).toContain('≻');
    expect(root.textContent).toContain('4');
    // Pełne etykiety portów NIE są renderowane jako tekst (są w title handli)
    expect(root.textContent).not.toMatch(/Vec4|R\s*G\s*B/);

    // 4 wejścia + 1 wyjście
    expect(container.querySelectorAll('.react-flow__handle.target')).toHaveLength(4);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(1);
  });

  it('split_vec3 renders slim with ≺ symbol and 3 outputs', async () => {
    const { container } = renderNode(NODE_REGISTRY.split_vec3);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const root = getSlimRoot(container);
    expect(root.getAttribute('title')).toContain('Split (Vec3)');
    expect(root.style.width).toBe('36px');
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
    expect(targetTitles).toEqual(['R', 'G', 'B', 'A']);
  });

  it('smart_split (auto) also renders slim with A badge before adaptation', async () => {
    const { container } = renderNode(NODE_REGISTRY.smart_split);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const root = getSlimRoot(container);
    expect(root.textContent).toContain('≺');
    expect(root.textContent).toContain('A');
  });

  it('smart_compose badge cycles output type on click (vec3 → vec4 → vec2)', async () => {
    const { container } = renderNode(NODE_REGISTRY.smart_compose);
    await waitFor(() => expect(getSlimRoot(container)).toBeTruthy());

    const badge = () => [...container.querySelectorAll('span')]
      .find(s => /^[234]$/.test(s.textContent || '')) as HTMLElement;

    expect(badge().textContent).toBe('3'); // domyślnie vec3

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('4'));

    fireEvent.click(badge());
    await waitFor(() => expect(badge().textContent).toBe('2'));
  });

  it('smart_compose is user-facing labeled "Combine (Auto)" (naming audit)', () => {
    expect(NODE_REGISTRY.smart_compose.label).toBe('Combine (Auto)');
  });
});
