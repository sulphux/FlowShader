import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import NodeEditor from './NodeEditor';

describe('built-in examples gallery integration', () => {
  beforeEach(() => localStorage.clear());

  it('opens from the toolbar and replaces the canvas only after confirmation', async () => {
    const { container } = render(<NodeEditor />);
    expect(container.querySelectorAll('.react-flow__node')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '📚 Examples' }));
    expect(screen.getByRole('dialog', { name: 'Start from an example' })).toBeInTheDocument();
    expect(container.querySelectorAll('.react-flow__node')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Loop \/ Iterate Basics/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Loop / Iterate Basics' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Start from an example' })).not.toBeInTheDocument());
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node')).toHaveLength(6));
    expect(screen.getByDisplayValue('11')).toBeInTheDocument();
  }, 20_000);
});
