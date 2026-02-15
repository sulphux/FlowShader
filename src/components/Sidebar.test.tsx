import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from './Sidebar';
import type { Node } from 'reactflow';
import * as customNodeManager from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';

// Mock customNodeManager
vi.mock('../core/customNodeManager', () => ({
  loadCustomNodes: vi.fn(),
  deleteCustomNode: vi.fn(),
}));

describe('Sidebar - Sidebar Context Menu', () => {
  const mockSetNodes = vi.fn();
  
  const defaultNodes: Node[] = [];

  // Helper to add custom node to NODE_REGISTRY
  const addCustomNodeToRegistry = (id: string, label: string) => {
    (NODE_REGISTRY as Record<string, unknown>)[id] = {
      id,
      label,
      isCustom: true,
      inputs: [],
      outputs: [],
      glslTemplate: () => 'vec3(1.0)',
    };
  };

  // Helper to remove custom node from NODE_REGISTRY
  const removeCustomNodeFromRegistry = (id: string) => {
    delete (NODE_REGISTRY as Record<string, unknown>)[id];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no custom nodes
    vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([]);
    // Clean up any custom nodes from previous tests
    Object.keys(NODE_REGISTRY).forEach(key => {
      if (key.startsWith('custom_') && key !== 'custom_input' && key !== 'custom_output') {
        delete (NODE_REGISTRY as Record<string, unknown>)[key];
      }
    });
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  describe('Delete action', () => {
    it('should show Delete option in sidebar context menu', () => {
      // Setup: One custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Find the custom node in sidebar
      const customNodeItem = screen.getByText('My Custom Node');
      expect(customNodeItem).toBeInTheDocument();

      // Right-click the custom node
      fireEvent.contextMenu(customNodeItem.parentElement!);

      // Expect "Delete Custom Node" option visible
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toHaveTextContent('🗑️ Delete Custom Node');
    });

    it('should call deleteCustomNode when Delete clicked', () => {
      // Setup: One custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click custom node
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);

      // Click Delete
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      fireEvent.click(deleteButton);

      // Expect deleteCustomNode called with custom node ID
      expect(customNodeManager.deleteCustomNode).toHaveBeenCalledWith('custom_mynode');
      expect(customNodeManager.deleteCustomNode).toHaveBeenCalledTimes(1);
    });

    it('should show alert when deletion succeeds', () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      // Setup: One custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click and delete
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);
      
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      fireEvent.click(deleteButton);

      // Expect success alert
      expect(alertMock).toHaveBeenCalledWith('✅ Custom node deleted successfully!');
      
      alertMock.mockRestore();
    });
  });

  describe('Warning for used custom nodes', () => {
    it('should show warning if custom node is used on canvas', () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      // Setup: Custom node instance on canvas
      const nodesWithCustom: Node[] = [
        {
          id: 'node-1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: {
            definition: {
              id: 'custom_mynode',
              label: 'My Custom Node',
              isCustom: true,
              inputs: [],
              outputs: [],
              glslTemplate: () => 'vec3(1.0)',
            },
          },
        },
      ];

      render(<Sidebar nodes={nodesWithCustom} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click and delete
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);
      
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      fireEvent.click(deleteButton);

      // Expect warning message (confirm dialog)
      expect(confirmMock).toHaveBeenCalledWith(
        expect.stringContaining('This custom node is currently used on the canvas')
      );
      
      // Should NOT delete if user cancels
      expect(customNodeManager.deleteCustomNode).not.toHaveBeenCalled();
      
      confirmMock.mockRestore();
    });

    it('should allow delete if not used on canvas', () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      // Setup: NO custom node on canvas (only built-in nodes)
      const nodesWithoutCustom: Node[] = [
        {
          id: 'node-1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: {
            definition: {
              id: 'math_add',
              label: 'Add',
              inputs: [],
              outputs: [],
              glslTemplate: () => 'a + b',
            },
          },
        },
      ];

      render(<Sidebar nodes={nodesWithoutCustom} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click and delete
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);
      
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      fireEvent.click(deleteButton);

      // Expect NO warning, direct delete (no confirm dialog shown)
      expect(confirmMock).not.toHaveBeenCalled();
      expect(customNodeManager.deleteCustomNode).toHaveBeenCalledWith('custom_mynode');
      
      confirmMock.mockRestore();
    });

    it('should proceed with deletion if user confirms warning', () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      // Setup: Custom node instance on canvas
      const nodesWithCustom: Node[] = [
        {
          id: 'node-1',
          type: 'shaderNode',
          position: { x: 0, y: 0 },
          data: {
            definition: {
              id: 'custom_mynode',
              label: 'My Custom Node',
              isCustom: true,
              inputs: [],
              outputs: [],
              glslTemplate: () => 'vec3(1.0)',
            },
          },
        },
      ];

      render(<Sidebar nodes={nodesWithCustom} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click and delete
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);
      
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      fireEvent.click(deleteButton);

      // Expect warning shown
      expect(confirmMock).toHaveBeenCalled();
      
      // Should proceed with deletion
      expect(customNodeManager.deleteCustomNode).toHaveBeenCalledWith('custom_mynode');
      
      confirmMock.mockRestore();
    });
  });

  describe('Menu positioning', () => {
    it('should render context menu at mouse position', () => {
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click at specific position
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!, {
        clientX: 250,
        clientY: 350,
      });

      // The context menu is rendered with position: fixed
      const deleteButton = screen.getByText(/Delete Custom Node/i);
      const menuElement = deleteButton.parentElement as HTMLElement;
      
      expect(menuElement).toBeInTheDocument();
      // The menu div (parent of button) has the positioning
      expect(menuElement.style.position).toBe('fixed');
      expect(menuElement.style.top).toBe('350px');
      expect(menuElement.style.left).toBe('250px');
    });

    it('should close menu when backdrop is clicked', () => {
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      const { container } = render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Open context menu
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);

      // Menu should be visible
      expect(screen.getByText(/Delete Custom Node/i)).toBeInTheDocument();

      // Click backdrop
      const backdrop = container.querySelector('[style*="position: fixed"]');
      fireEvent.click(backdrop!);

      // Menu should be closed (no longer visible)
      expect(screen.queryByText(/Delete Custom Node/i)).not.toBeInTheDocument();
    });
  });

  describe('Context menu restrictions', () => {
    it('should NOT show context menu for built-in nodes', () => {
      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Find a built-in node (e.g., "+" which is the Add node in Math category)
      const builtInNode = screen.getByText('+');
      expect(builtInNode).toBeInTheDocument();

      // Right-click the built-in node
      fireEvent.contextMenu(builtInNode.parentElement!);

      // Expect NO context menu shown
      expect(screen.queryByText(/Delete Custom Node/i)).not.toBeInTheDocument();
    });

    it('should NOT show context menu for custom_input/custom_output', () => {
      // Setup: In subgraph context (shows custom_input/custom_output)
      render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="MyCustomNode" />);

      // Find Custom Input node (label is "Input", not "Custom Input")
      const customInput = screen.getByText('Input');
      expect(customInput).toBeInTheDocument();

      // Right-click Custom Input
      fireEvent.contextMenu(customInput.parentElement!);

      // Expect NO context menu (these are system nodes, not deletable)
      expect(screen.queryByText(/Delete Custom Node/i)).not.toBeInTheDocument();
    });

    it('should only show context menu for user custom nodes', () => {
      // Setup: Custom node in library
      const customNodeDef = {
        id: 'custom_mynode',
        label: 'My Custom Node',
        isCustom: true,
        inputs: [],
        outputs: [],
        glslTemplate: () => 'vec3(1.0)',
        subgraph: { nodes: [], edges: [] },
      };
      
      vi.mocked(customNodeManager.loadCustomNodes).mockReturnValue([customNodeDef as ReturnType<typeof customNodeManager.loadCustomNodes>[0]]);
      addCustomNodeToRegistry('custom_mynode', 'My Custom Node');

      const { container } = render(<Sidebar nodes={defaultNodes} setNodes={mockSetNodes} currentContext="Main" />);

      // Right-click custom node (should work)
      const customNodeItem = screen.getByText('My Custom Node');
      fireEvent.contextMenu(customNodeItem.parentElement!);
      expect(screen.getByText(/Delete Custom Node/i)).toBeInTheDocument();

      // Close menu by clicking backdrop
      const backdrop = container.querySelectorAll('[style*="position: fixed"]')[0];
      fireEvent.click(backdrop!);

      // Menu should be closed
      expect(screen.queryByText(/Delete Custom Node/i)).not.toBeInTheDocument();

      // Right-click built-in node (should NOT work) - "+" is the Add node
      const builtInNode = screen.getByText('+');
      fireEvent.contextMenu(builtInNode.parentElement!);
      expect(screen.queryByText(/Delete Custom Node/i)).not.toBeInTheDocument();
    });
  });
});
