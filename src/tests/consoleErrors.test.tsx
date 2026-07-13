import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import NodeEditor from '../components/NodeEditor';

describe('Console Error Detection', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should not produce console errors on initial render', () => {
    render(<NodeEditor />);
    
    // Filter out expected warnings (jsdom canvas, React DevTools, React internals)
    const errors = consoleErrorSpy.mock.calls.filter(call => {
      const msg = String(call[0]);
      return !msg.includes('HTMLCanvasElement') && 
             !msg.includes('React DevTools') &&
             !msg.includes('Not implemented') &&
             !msg.includes('Error occurred in the');
    });
    
    expect(errors).toHaveLength(0);
  });

  it('should not produce critical React warnings', () => {
    render(<NodeEditor />);
    
    const warnings = consoleWarnSpy.mock.calls.filter(call => {
      const msg = String(call[0]);
      // Canvas warnings are a jsdom limitation; React/React Flow warnings are regressions.
      return (msg.includes('React') || msg.includes('Warning')) &&
             !msg.includes('Canvas');
    });
    
    expect(warnings).toHaveLength(0);
  });

  it('should not have glslTemplate errors', () => {
    render(<NodeEditor />);
    
    // Check for the specific error we fixed
    const glslErrors = consoleErrorSpy.mock.calls.filter(call => {
      const msg = String(call[0]);
      return msg.includes('glslTemplate') && msg.includes('not a function');
    });
    
    expect(glslErrors).toHaveLength(0);
  });
});
