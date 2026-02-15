import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextMenu from '../components/ContextMenu';

describe('Create Custom Node from Context Menu', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    onClose: vi.fn(),
    onAddNode: vi.fn(),
  };

  it('should enable "Create Custom Node" with selection', () => {
    const onCreateCustom = vi.fn();
    
    render(
      <ContextMenu
        {...defaultProps}
        onCreateCustom={onCreateCustom}
        hasSelection={true}
      />
    );

    const createButton = screen.getByText(/Create Custom Node/i);
    expect(createButton).toBeDefined();
    
    // Should be enabled (opacity: 1, cursor: pointer)
    expect(createButton.style.opacity).toBe('1');
    expect(createButton.style.cursor).toBe('pointer');
  });

  it('should enable "Create Custom Node" without selection (empty custom node)', () => {
    const onCreateCustom = vi.fn();
    
    render(
      <ContextMenu
        {...defaultProps}
        onCreateCustom={onCreateCustom}
        hasSelection={false}
      />
    );

    const createButton = screen.getByText(/Create Custom Node/i);
    expect(createButton).toBeDefined();
    
    // Should be enabled even without selection (can create empty custom node)
    expect(createButton.style.opacity).toBe('1');
    expect(createButton.style.cursor).toBe('pointer');
  });

  it('should show "Create Custom Node" in pane context menu', () => {
    const onCreateCustom = vi.fn();
    
    render(
      <ContextMenu
        {...defaultProps}
        onCreateCustom={onCreateCustom}
        filterType={null}
      />
    );

    const createButton = screen.getByText(/Create Custom Node/i);
    expect(createButton).toBeDefined();
  });

  it('should NOT show "Create Custom Node" in filtered context menu', () => {
    const onCreateCustom = vi.fn();
    
    render(
      <ContextMenu
        {...defaultProps}
        onCreateCustom={onCreateCustom}
        filterType="float"
      />
    );

    const createButton = screen.queryByText(/Create Custom Node/i);
    expect(createButton).toBeNull();
  });

  it('should call onCreateCustom when clicked', () => {
    const onCreateCustom = vi.fn();
    const onClose = vi.fn();
    
    render(
      <ContextMenu
        {...defaultProps}
        onCreateCustom={onCreateCustom}
        onClose={onClose}
        hasSelection={false}
      />
    );

    const createButton = screen.getByText(/Create Custom Node/i);
    fireEvent.click(createButton);

    expect(onCreateCustom).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
