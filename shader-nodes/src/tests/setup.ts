import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Custom matchers are available via @testing-library/jest-dom
// Examples: toBeInTheDocument, toHaveClass, toHaveStyle, etc.
