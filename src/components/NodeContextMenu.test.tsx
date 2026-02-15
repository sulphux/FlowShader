import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NodeContextMenu from './NodeContextMenu';

describe('NodeContextMenu - Node Context Menu', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    nodeId: 'node-1',
    nodeName: 'Test Node',
    isCustomNode: false,
    isLastOutput: false,
    onClose: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onDelete: vi.fn(),
  };

  describe('Copy/Cut/Delete actions', () => {
    it('should show Copy action on node right-click', () => {
      render(<NodeContextMenu {...defaultProps} />);

      const copyButton = screen.getByText(/Copy/i);
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveTextContent('📋 Copy (Ctrl+C)');
    });

    it('should show Cut action', () => {
      render(<NodeContextMenu {...defaultProps} />);

      const cutButton = screen.getByText(/Cut/i);
      expect(cutButton).toBeInTheDocument();
      expect(cutButton).toHaveTextContent('✂️ Cut (Ctrl+X)');
    });

    it('should show Delete action', () => {
      render(<NodeContextMenu {...defaultProps} />);

      const deleteButton = screen.getByText(/Delete/i);
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toHaveTextContent('🗑️ Delete (Del)');
    });

    it('should call onCopy when Copy clicked', () => {
      const onCopy = vi.fn();
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          onCopy={onCopy}
          onClose={onClose}
        />
      );

      const copyButton = screen.getByText(/Copy/i);
      fireEvent.click(copyButton);

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onCut when Cut clicked', () => {
      const onCut = vi.fn();
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          onCut={onCut}
          onClose={onClose}
        />
      );

      const cutButton = screen.getByText(/Cut/i);
      fireEvent.click(cutButton);

      expect(onCut).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete when Delete clicked (non-last Output)', () => {
      const onDelete = vi.fn();
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          isLastOutput={false}
          onDelete={onDelete}
          onClose={onClose}
        />
      );

      const deleteButton = screen.getByText(/Delete/i);
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete disabled for last Output node', () => {
    it('should disable Delete for last Output node', () => {
      const onDelete = vi.fn();
      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="Output"
          isLastOutput={true}
          onDelete={onDelete}
        />
      );

      const deleteButton = screen.getByText(/Delete/i);
      fireEvent.click(deleteButton);

      // Should show alert instead of calling onDelete
      expect(alertMock).toHaveBeenCalledWith(
        'Cannot delete the last Output node!\n\nAt least one Output node must remain in the graph.'
      );
      expect(onDelete).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });

    it('should enable Delete for Output if multiple exist', () => {
      const onDelete = vi.fn();
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="Output"
          isLastOutput={false}
          onDelete={onDelete}
          onClose={onClose}
        />
      );

      const deleteButton = screen.getByText(/Delete/i);
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Definition for custom nodes', () => {
    it('should show Edit Definition for custom nodes', () => {
      const onEditCustom = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="MyCustomNode"
          isCustomNode={true}
          onEditCustom={onEditCustom}
        />
      );

      const editButton = screen.getByText(/Edit Definition/i);
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveTextContent('🔧 Edit Definition');
    });

    it('should NOT show Edit Definition for built-in nodes', () => {
      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="Add"
          isCustomNode={false}
        />
      );

      const editButton = screen.queryByText(/Edit Definition/i);
      expect(editButton).not.toBeInTheDocument();
    });

    it('should call onEditCustom when Edit Definition clicked', () => {
      const onEditCustom = vi.fn();
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="MyCustomNode"
          isCustomNode={true}
          onEditCustom={onEditCustom}
          onClose={onClose}
        />
      );

      const editButton = screen.getByText(/Edit Definition/i);
      fireEvent.click(editButton);

      expect(onEditCustom).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Menu positioning', () => {
    it('should render at mouse position', () => {
      const { container } = render(
        <NodeContextMenu
          {...defaultProps}
          x={200}
          y={300}
        />
      );

      const menu = container.querySelector('[style*="position: absolute"]');
      expect(menu).toBeInTheDocument();
      
      // Check that the menu is positioned at the specified coordinates
      const menuElement = menu as HTMLElement;
      expect(menuElement.style.top).toBe('300px');
      expect(menuElement.style.left).toBe('200px');
    });

    it('should position menu at different coordinates', () => {
      const { container } = render(
        <NodeContextMenu
          {...defaultProps}
          x={450}
          y={150}
        />
      );

      const menu = container.querySelector('[style*="position: absolute"]') as HTMLElement;
      expect(menu.style.top).toBe('150px');
      expect(menu.style.left).toBe('450px');
    });
  });

  describe('Menu interaction', () => {
    it('should close menu when backdrop is clicked', () => {
      const onClose = vi.fn();

      const { container } = render(
        <NodeContextMenu
          {...defaultProps}
          onClose={onClose}
        />
      );

      const backdrop = container.querySelector('[style*="position: fixed"]');
      expect(backdrop).toBeInTheDocument();
      
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close menu on right-click (context menu)', () => {
      const onClose = vi.fn();

      const { container } = render(
        <NodeContextMenu
          {...defaultProps}
          onClose={onClose}
        />
      );

      const backdrop = container.querySelector('[style*="position: fixed"]');
      fireEvent.contextMenu(backdrop!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside menu', () => {
      const onClose = vi.fn();

      render(
        <NodeContextMenu
          {...defaultProps}
          onClose={onClose}
        />
      );

      // Click on the Copy button (inside the menu)
      const copyButton = screen.getByText(/Copy/i);
      const menuDiv = copyButton.closest('[style*="position: absolute"]');
      
      fireEvent.click(menuDiv!);
      
      // Should NOT close just from clicking the menu container
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Node name display', () => {
    it('should display the node name in menu header', () => {
      render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="MyCustomNode"
        />
      );

      const nameHeader = screen.getByText('MyCustomNode');
      expect(nameHeader).toBeInTheDocument();
    });

    it('should display different node names correctly', () => {
      const { rerender } = render(
        <NodeContextMenu
          {...defaultProps}
          nodeName="Add"
        />
      );

      expect(screen.getByText('Add')).toBeInTheDocument();

      rerender(
        <NodeContextMenu
          {...defaultProps}
          nodeName="Vector Split"
        />
      );

      expect(screen.getByText('Vector Split')).toBeInTheDocument();
    });
  });

  describe('Menu styling and structure', () => {
    it('should have proper z-index for overlay', () => {
      const { container } = render(<NodeContextMenu {...defaultProps} />);

      const backdrop = container.querySelector('[style*="position: fixed"]') as HTMLElement;
      expect(backdrop.style.zIndex).toBe('99999');

      const menu = container.querySelector('[style*="position: absolute"]') as HTMLElement;
      expect(menu.style.zIndex).toBe('100000');
    });

    it('should show separator between sections', () => {
      const { container } = render(
        <NodeContextMenu
          {...defaultProps}
          isCustomNode={true}
          onEditCustom={vi.fn()}
        />
      );

      // Look for separator divs
      const separators = container.querySelectorAll('[style*="height: 1px"]');
      expect(separators.length).toBeGreaterThan(0);
    });
  });
});
