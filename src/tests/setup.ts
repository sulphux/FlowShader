import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver for ReactFlow
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Custom matchers are available via @testing-library/jest-dom
// Examples: toBeInTheDocument, toHaveClass, toHaveStyle, etc.
