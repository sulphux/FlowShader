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
    setRenderTarget() {}
    getDrawingBufferSize(target: { x: number; y: number }) {
      target.x = 4; target.y = 4;
      return target;
    }
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

  class MockWebGLRenderTarget {
    texture = {};
    dispose() {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    ShaderMaterial: MockShaderMaterial,
    WebGLRenderTarget: MockWebGLRenderTarget,
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

describe('ShaderPreview feedback (ping-pong) buffers', () => {
  beforeEach(() => {
    mockGetShaderValidationReport.mockReturnValue({
      valid: true, errors: [], warnings: [], source: 'heuristic',
    });
  });

  const feedbackResources = { textures: [], usesAudio: false, usesFeedback: true };

  it('isMainOutput + a feedback-using graph populates the shared texture after a frame', async () => {
    const { sharedFeedbackTexture } = await import('../core/feedbackBuffer');
    sharedFeedbackTexture.current = null;
    vi.useFakeTimers();
    try {
      render(<ShaderPreview shaderCode="void main(){}" resources={feedbackResources} isMainOutput />);
      // First animate() runs synchronously during mount, before the recompile
      // effect sets usesFeedbackRef — advance a frame so it runs again with
      // feedback actually recognized, allocating the ping-pong buffers.
      await vi.advanceTimersByTimeAsync(20);
      expect(sharedFeedbackTexture.current).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a non-main-output instance (e.g. a Preview node) never owns ping-pong state, even with a feedback-using graph', async () => {
    const { sharedFeedbackTexture } = await import('../core/feedbackBuffer');
    sharedFeedbackTexture.current = null;
    vi.useFakeTimers();
    try {
      render(<ShaderPreview shaderCode="void main(){}" resources={feedbackResources} />);
      await vi.advanceTimersByTimeAsync(20);
      // Only isMainOutput writes to the shared texture — a plain Preview tap must not.
      expect(sharedFeedbackTexture.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
