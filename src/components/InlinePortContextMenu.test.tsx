import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InlinePortContextMenu from './InlinePortContextMenu';

describe('InlinePortContextMenu', () => {
  it('splits a vector port into named components', () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(
      <InlinePortContextMenu
        x={20} y={20} direction="input" portLabel="A" portType="vec2"
        expanded={false} canCollapse={true} onToggle={onToggle} onClose={onClose}
      />,
    );

    fireEvent.click(getByRole('menuitem', { name: '⑂ Split into X / Y' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not hide component ports while they still have wires', () => {
    const onToggle = vi.fn();
    const { getByRole, getByText } = render(
      <InlinePortContextMenu
        x={20} y={20} direction="output" portLabel="RGB" portType="vec3"
        expanded canCollapse={false} onToggle={onToggle} onClose={() => undefined}
      />,
    );

    const collapse = getByRole('menuitem', { name: '◀ Collapse components' });
    expect(collapse).toBeDisabled();
    expect(getByText('Disconnect component wires before collapsing.')).toBeTruthy();
    fireEvent.click(collapse);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
