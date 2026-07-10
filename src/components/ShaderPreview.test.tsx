import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShaderPreview from './ShaderPreview';

const mockGetShaderValidationReport = vi.fn();

vi.mock('../core/validator', () => ({
  getShaderValidationReport: (...args: unknown[]) => mockGetShaderValidationReport(...args),
}));

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
  }

  class MockShaderMaterial {
    uniforms: Record<string, { value: unknown }>;
    constructor(config: { uniforms?: Record<string, { value: unknown }> }) {
      this.uniforms = config.uniforms ?? {};
    }
    dispose() {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    ShaderMaterial: MockShaderMaterial,
  };
});

describe('ShaderPreview debug report', () => {
  beforeEach(() => {
    mockGetShaderValidationReport.mockReset();
  });

  it('should render compilation error with detailed validation report', () => {
    mockGetShaderValidationReport.mockReturnValue({
      valid: false,
      error: 'line 3: syntax error',
      errors: [{ severity: 'error', line: 3, message: 'syntax error', code: 'ERROR: 0:3: syntax error' }],
      warnings: [{ severity: 'warning', message: 'possible type mismatch: assigning vec3 expression to float' }],
      source: 'glslang+heuristic',
      glslang: {
        available: true,
        ok: false,
        output: 'ERROR: shader.frag:3: syntax error',
        command: 'glslangValidator',
      },
    });

    render(<ShaderPreview shaderCode={'precision mediump float;\nvoid main(){ gl_FragColor = vec4(1.0) }'} />);

    expect(screen.getByText('COMPILATION ERROR')).toBeInTheDocument();
    expect(screen.getAllByText(/L3: syntax error/)).not.toHaveLength(0);
    expect(screen.getByText('Validation details')).toBeInTheDocument();
    expect(screen.getByText(/validation-source: glslang\+heuristic/)).toBeInTheDocument();
    expect(screen.getByText(/glslang: failed/)).toBeInTheDocument();
    expect(screen.getByText(/possible type mismatch/)).toBeInTheDocument();
  });

  it('should render debug summary for valid shader diagnostics', () => {
    mockGetShaderValidationReport.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [{ severity: 'warning', message: 'possible type mismatch: assigning vec3 expression to float' }],
      source: 'glslang+heuristic',
      glslang: {
        available: true,
        ok: true,
        output: '',
        command: 'glslangValidator',
      },
    });

    render(<ShaderPreview shaderCode={'precision mediump float;\nvoid main(){ gl_FragColor = vec4(1.0); }'} />);

    expect(screen.getByText('SHADER DEBUG REPORT')).toBeInTheDocument();
    expect(screen.getByText(/Shader validation passed \| errors=0 \| warnings=1/)).toBeInTheDocument();
    expect(screen.getByText('Validation details')).toBeInTheDocument();
  });
});
