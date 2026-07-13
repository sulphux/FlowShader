import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { NODE_REGISTRY } from '../nodes';

const renderFloatParam = (value?: unknown) => render(
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

const valueInput = () => screen.getByLabelText('Float value') as HTMLInputElement;

describe('Float Param editor', () => {
  it('has one explicit value field and one accessible decrement/increment pair', async () => {
    renderFloatParam(0.5);
    await waitFor(() => expect(valueInput()).toBeInTheDocument());

    expect(screen.getAllByLabelText('Decrease float')).toHaveLength(1);
    expect(screen.getAllByLabelText('Increase float')).toHaveLength(1);
    expect(valueInput()).toHaveAttribute('type', 'text');
    expect(valueInput()).toHaveAttribute('inputmode', 'decimal');
  });

  it('increments and decrements without forcing two decimal places', async () => {
    renderFloatParam(0.001);
    await waitFor(() => expect(valueInput()).toHaveValue('0.001'));

    fireEvent.click(screen.getByLabelText('Increase float'));
    await waitFor(() => expect(valueInput()).toHaveValue('0.011'));

    fireEvent.click(screen.getByLabelText('Decrease float'));
    await waitFor(() => expect(valueInput()).toHaveValue('0.001'));
  });

  it('accepts values below 0.05 and a decimal comma, committing on Enter', async () => {
    renderFloatParam(0.5);
    await waitFor(() => expect(valueInput()).toBeInTheDocument());

    fireEvent.change(valueInput(), { target: { value: '0,001' } });
    expect(valueInput()).toHaveValue('0,001');
    fireEvent.keyDown(valueInput(), { key: 'Enter' });

    await waitFor(() => expect(valueInput()).toHaveValue('0.001'));
  });

  it('allows a temporarily empty draft and Backspace without losing the node', async () => {
    const { container } = renderFloatParam(0.5);
    await waitFor(() => expect(valueInput()).toBeInTheDocument());

    fireEvent.change(valueInput(), { target: { value: '' } });
    fireEvent.keyDown(valueInput(), { key: 'Backspace' });

    expect(valueInput()).toHaveValue('');
    expect(container.querySelector('[data-testid="rf__node-p1"]')).toBeInTheDocument();
  });

  it('supports Arrow step, Shift ×10 and Alt ×0.1', async () => {
    renderFloatParam(0);
    await waitFor(() => expect(valueInput()).toHaveValue('0'));

    fireEvent.keyDown(valueInput(), { key: 'ArrowUp' });
    expect(valueInput()).toHaveValue('0.01');
    fireEvent.keyDown(valueInput(), { key: 'ArrowUp', shiftKey: true });
    expect(valueInput()).toHaveValue('0.11');
    fireEvent.keyDown(valueInput(), { key: 'ArrowDown', altKey: true });
    expect(valueInput()).toHaveValue('0.109');
  });

  it('lets the step be changed to 0.001 from settings', async () => {
    renderFloatParam(0);
    await waitFor(() => expect(valueInput()).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Float settings'));

    const stepInput = screen.getByLabelText('Float step') as HTMLInputElement;
    fireEvent.change(stepInput, { target: { value: '0.001' } });
    await waitFor(() => expect(stepInput).toHaveValue(0.001));

    fireEvent.keyDown(valueInput(), { key: 'ArrowUp' });
    await waitFor(() => expect(valueInput()).toHaveValue('0.001'));
  });

  it('clamps button nudges at the configured range', async () => {
    renderFloatParam(-10);
    await waitFor(() => expect(valueInput()).toHaveValue('-10'));
    fireEvent.click(screen.getByLabelText('Decrease float'));
    expect(valueInput()).toHaveValue('-10');
  });

  it('keeps native number spinners hidden on numeric settings fields', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    expect(css).toContain('input[type="number"]::-webkit-inner-spin-button');
    expect(css).toContain('input[type="number"]::-webkit-outer-spin-button');
    expect(css).toMatch(/input\[type="number"\]\s*\{[^}]*appearance:\s*textfield/);
  });
});
