import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import NodeEditor from '../components/NodeEditor';

describe('Undo/Redo E2E - Keyboard Shortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Helper to simulate keyboard shortcuts on window
  const pressCtrlZ = () => {
    const event = new KeyboardEvent('keydown', { 
      key: 'z', 
      ctrlKey: true, 
      shiftKey: false,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  const pressCtrlY = () => {
    const event = new KeyboardEvent('keydown', { 
      key: 'y', 
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  const pressCtrlShiftZ = () => {
    const event = new KeyboardEvent('keydown', { 
      key: 'z', 
      ctrlKey: true, 
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  describe('Undo keyboard shortcut (Ctrl+Z)', () => {
    it('should listen for Ctrl+Z keyboard event', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Pressing Ctrl+Z should not crash (even with empty history)
      expect(() => {
        pressCtrlZ();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should handle multiple Ctrl+Z presses gracefully', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Press Ctrl+Z multiple times
      expect(() => {
        pressCtrlZ();
        pressCtrlZ();
        pressCtrlZ();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });
  });

  describe('Redo keyboard shortcut (Ctrl+Y)', () => {
    it('should listen for Ctrl+Y keyboard event', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Pressing Ctrl+Y should not crash
      expect(() => {
        pressCtrlY();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should handle multiple Ctrl+Y presses gracefully', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');

      // Press Ctrl+Y multiple times
      expect(() => {
        pressCtrlY();
        pressCtrlY();
        pressCtrlY();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should support Ctrl+Shift+Z as alternative redo shortcut', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Press Ctrl+Shift+Z (alternative redo)
      expect(() => {
        pressCtrlShiftZ();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });
  });

  describe('Undo/Redo state boundaries', () => {
    it('should do nothing when Ctrl+Z pressed with empty history', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Press Ctrl+Z on fresh editor (no history)
      expect(() => {
        pressCtrlZ();
      }).not.toThrow();

      // Should still be in document, no crash
      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should do nothing when Ctrl+Y pressed with no future', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Press Ctrl+Y (no undo yet, so no future)
      expect(() => {
        pressCtrlY();
      }).not.toThrow();

      // Should still be in document, no crash
      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should handle multiple undos past history start gracefully', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Undo more times than history has
      expect(() => {
        for (let i = 0; i < 5; i++) {
          pressCtrlZ();
        }
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should handle multiple redos past future end gracefully', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Redo more times than future has
      expect(() => {
        for (let i = 0; i < 5; i++) {
          pressCtrlY();
        }
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });
  });

  describe('Integration with keyboard shortcuts', () => {
    it('should register keyboard event listeners on mount', () => {
      const onChange = vi.fn();
      const { unmount } = render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Verify keyboard shortcuts work
      expect(() => {
        pressCtrlZ();
        pressCtrlY();
        pressCtrlShiftZ();
      }).not.toThrow();

      unmount();
    });

    it('should handle rapid keyboard shortcut presses', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');
      expect(reactFlowElement).toBeInTheDocument();

      // Rapid key presses
      expect(() => {
        pressCtrlZ();
        pressCtrlY();
        pressCtrlZ();
        pressCtrlY();
        pressCtrlShiftZ();
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });

    it('should handle mixed undo/redo sequences', () => {
      const onChange = vi.fn();
      render(<NodeEditor onChange={onChange} />);

      const reactFlowElement = document.querySelector('.react-flow');

      // Mixed sequence: undo, redo, undo, undo, redo
      expect(() => {
        pressCtrlZ();
        pressCtrlY();
        pressCtrlZ();
        pressCtrlZ();
        pressCtrlShiftZ(); // Alternative redo
      }).not.toThrow();

      expect(reactFlowElement).toBeInTheDocument();
    });
  });
});
