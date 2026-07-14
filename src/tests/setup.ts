import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.removeItem('flowshader-language-v1');
});

// Mock ResizeObserver for ReactFlow
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Custom matchers are available via @testing-library/jest-dom
// Examples: toBeInTheDocument, toHaveClass, toHaveStyle, etc.
