import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NodeEditor from '../components/NodeEditor';

const STORAGE_KEY = 'shader-nodes-save-v1';

describe('Float Param versus global graph shortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [
        { id: 'float1', type: 'shaderNode', position: { x: 0, y: 0 }, selected: true, data: { definition: { id: 'param_float' }, value: '0.5' } },
        { id: 'out1', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: { id: 'output' } } },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  });

  it('Backspace edits the focused value instead of deleting the selected node', async () => {
    const { container } = render(<NodeEditor />);
    const input = await screen.findByLabelText('Float value') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Backspace', bubbles: true });

    expect(input).toHaveValue('');
    await waitFor(() => expect(container.querySelector('[data-id="float1"]')).toBeTruthy());
  });
});

