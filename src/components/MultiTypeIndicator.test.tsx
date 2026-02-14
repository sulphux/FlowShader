import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MultiTypeIndicator } from './MultiTypeIndicator';

describe('MultiTypeIndicator', () => {
  it('should render gradient for float|vec3', () => {
    const { container } = render(
      <MultiTypeIndicator types="float|vec3" size={10} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.style.background).toContain('gradient');
  });

  it('should split types by pipe character', () => {
    const types = 'float|vec3';
    const split = types.split('|');
    
    expect(split).toEqual(['float', 'vec3']);
  });

  it('should handle single type without pipe', () => {
    const { container } = render(
      <MultiTypeIndicator types="vec3" size={10} />
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('should use correct size prop', () => {
    const { container } = render(
      <MultiTypeIndicator types="float|vec3" size={16} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toContain('16');
    expect(wrapper.style.height).toContain('16');
  });
});
