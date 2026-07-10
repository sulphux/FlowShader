import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

/**
 * Regresja: kropki (handles) w kompaktowych nodach matematycznych (+,-,×,÷)
 * były zsunięte w dół. Przyczyna: handles mają inline position:relative,
 * ale dziedziczyły top:50% + translateY(-50%) z domyślnego CSS reactflow
 * (a hover wymuszał translate z !important).
 * Fix: klasa .handle-inline + inline top:auto/transform:none.
 */

const renderCompactNode = (defId: keyof typeof NODE_REGISTRY) => {
  return render(
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[{
          id: 'n1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: { definition: NODE_REGISTRY[defId] },
        }]}
        nodeTypes={{ shaderNode: ShaderNode }}
      />
    </ReactFlowProvider>
  );
};

const mathOps: Array<keyof typeof NODE_REGISTRY> = ['math_add', 'math_sub', 'math_mult', 'math_div'];

describe('Compact node handle alignment', () => {
  mathOps.forEach(op => {
    it(`${String(op)}: all handles neutralize reactflow top/transform offsets`, async () => {
      const { container } = renderCompactNode(op);

      await waitFor(() => {
        expect(container.querySelectorAll('.react-flow__handle').length).toBeGreaterThan(0);
      });

      const handles = [...container.querySelectorAll('.react-flow__handle')] as HTMLElement[];
      // 2 wejścia (a, b) + 1 wyjście
      expect(handles).toHaveLength(3);

      handles.forEach(handle => {
        expect(handle).toHaveClass('handle-inline');
        expect(handle.style.position).toBe('relative');
        expect(handle.style.top).toBe('auto');
        expect(handle.style.transform).toBe('none');
      });
    });
  });

  it('CSS overrides the default reactflow handle offset for .handle-inline', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    // Reguła bazowa neutralizująca top/transform
    expect(css).toMatch(/\.react-flow__handle\.handle-inline\s*\{[^}]*top:\s*auto/);
    expect(css).toMatch(/\.react-flow__handle\.handle-inline\s*\{[^}]*transform:\s*none/);
    // Hover nie może przywracać translate(0, -50%) dla handle-inline
    expect(css).toMatch(/\.react-flow__handle\.handle-inline:hover\s*\{[^}]*transform:\s*scale\(1\.4\)\s*!important/);
  });

  it('non-compact nodes keep default absolute handle positioning (no regression)', async () => {
    // sdf_circle to zwykły (nie-compact, nie-slim) node
    const { container } = renderCompactNode('sdf_circle');

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__handle').length).toBeGreaterThan(0);
    });

    const handles = [...container.querySelectorAll('.react-flow__handle')] as HTMLElement[];
    handles.forEach(handle => {
      expect(handle).not.toHaveClass('handle-inline');
    });
  });
});
