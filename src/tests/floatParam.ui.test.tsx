import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

/**
 * Regresja: Float Param miał dwa mechanizmy inkrementacji wartości —
 * własne strzałki ◀▶ oraz natywne spinnery input[type=number].
 * Zostaje jeden: strzałki ◀▶ (natywne spinnery ukryte w CSS).
 */

const renderFloatParam = (value?: unknown) => {
  return render(
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[{
          id: 'p1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: { definition: NODE_REGISTRY.param_float, value },
        }]}
        nodeTypes={{ shaderNode: ShaderNode }}
      />
    </ReactFlowProvider>
  );
};

describe('Float Param - single increment mechanism', () => {
  it('renders exactly one pair of ◀/▶ arrows and one number input', async () => {
    renderFloatParam(0.5);
    await waitFor(() => expect(screen.getByText('◀')).toBeInTheDocument());

    expect(screen.getAllByText('◀')).toHaveLength(1);
    expect(screen.getAllByText('▶')).toHaveLength(1);
    expect(document.querySelectorAll('input[type="number"]')).toHaveLength(1);
  });

  it('▶ increments the value by step', async () => {
    renderFloatParam(0.5);
    await waitFor(() => expect(screen.getByText('▶')).toBeInTheDocument());

    fireEvent.click(screen.getByText('▶'));

    await waitFor(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      expect(parseFloat(input.value)).toBeCloseTo(0.51, 5);
    });
  });

  it('◀ decrements the value by step', async () => {
    renderFloatParam(0.5);
    await waitFor(() => expect(screen.getByText('◀')).toBeInTheDocument());

    fireEvent.click(screen.getByText('◀'));

    await waitFor(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      expect(parseFloat(input.value)).toBeCloseTo(0.49, 5);
    });
  });

  it('clamps at min when decrementing', async () => {
    renderFloatParam(0.0); // min = 0.0
    await waitFor(() => expect(screen.getByText('◀')).toBeInTheDocument());

    fireEvent.click(screen.getByText('◀'));

    await waitFor(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      expect(parseFloat(input.value)).toBe(0);
    });
  });

  it('clamps at max when incrementing', async () => {
    renderFloatParam(10.0); // max = 10.0
    await waitFor(() => expect(screen.getByText('▶')).toBeInTheDocument());

    fireEvent.click(screen.getByText('▶'));

    await waitFor(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      expect(parseFloat(input.value)).toBe(10);
    });
  });

  it('global CSS hides native number-input spinners (no second mechanism)', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    expect(css).toContain('input[type="number"]::-webkit-inner-spin-button');
    expect(css).toContain('input[type="number"]::-webkit-outer-spin-button');
    expect(css).toMatch(/input\[type="number"\]\s*\{[^}]*appearance:\s*textfield/);
  });
});
