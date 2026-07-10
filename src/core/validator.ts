import { shaderDebug } from './shaderDebug';
import { hasGlslangValidator, validateWithGlslangValidator } from './glslangValidation';

// Singleton kontekstu WebGL (żeby nie tworzyć tysięcy canvasów)
let glContext: WebGLRenderingContext | null = null;

function getTestContext() {
  if (!glContext) {
    const canvas = document.createElement('canvas');
    glContext = canvas.getContext('webgl');
  }
  return glContext;
}

export interface ShaderValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  code?: string;
}

export interface ShaderValidationReport {
  valid: boolean;
  error?: string;
  errors: ShaderValidationIssue[];
  warnings: ShaderValidationIssue[];
  source: 'webgl' | 'heuristic' | 'webgl+heuristic' | 'unavailable' | 'glslang' | 'glslang+heuristic' | 'webgl+glslang+heuristic' | 'webgl+glslang';
  glslang?: {
    available: boolean;
    ok: boolean;
    output?: string;
    command?: string;
  };
}

const GLSL_TYPE_PATTERN = /(float|vec2|vec3|vec4)\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+);/;

const analyzeShaderStructure = (fragmentShaderBody: string): ShaderValidationIssue[] => {
  const issues: ShaderValidationIssue[] = [];
  const lines = fragmentShaderBody.split(/\r?\n/);
  let insideMain = false;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNo = index + 1;

    if (/void\s+main\s*\(\s*\)/.test(line)) {
      insideMain = true;
    }

    if (insideMain && /\}/.test(line)) {
      insideMain = false;
    }

    if (!line) return;

    if (insideMain && /^uniform\s+/.test(line)) {
      issues.push({
        severity: 'error',
        message: 'uniform declaration found inside main(); uniforms are only allowed in global scope',
        line: lineNo,
        code: rawLine.trim(),
      });
    }

    if (insideMain && /^precision\s+/.test(line)) {
      issues.push({
        severity: 'error',
        message: 'precision directive found inside main(); precision must be declared in global scope',
        line: lineNo,
        code: rawLine.trim(),
      });
    }

    if (/^void\s+main\s*\(\s*\)/.test(line) && (fragmentShaderBody.match(/void\s+main\s*\(\s*\)/g) || []).length > 1) {
      issues.push({
        severity: 'error',
        message: 'multiple main() functions detected',
        line: lineNo,
        code: rawLine.trim(),
      });
    }

    const typeMatch = line.match(GLSL_TYPE_PATTERN);
    if (typeMatch) {
      const declaredType = typeMatch[1];
      const rhs = typeMatch[2].trim();
      const constructorMatch = rhs.match(/^(float|vec2|vec3|vec4)\s*\(/);
      if (constructorMatch && constructorMatch[1] !== declaredType) {
        issues.push({
          severity: 'warning',
          message: `possible type mismatch: assigning ${constructorMatch[1]} expression to ${declaredType}`,
          line: lineNo,
          code: rawLine.trim(),
        });
      }
    }

    if (/gl_FragColor\s*=\s*vec4\([^)]*$/.test(line)) {
      issues.push({
        severity: 'error',
        message: 'gl_FragColor assignment looks incomplete on this line',
        line: lineNo,
        code: rawLine.trim(),
      });
    }
  });

  const precisionCount = (fragmentShaderBody.match(/precision\s+mediump\s+float/g) || []).length;
  if (precisionCount === 0) {
    issues.push({ severity: 'error', message: 'missing precision mediump float directive' });
  } else if (precisionCount > 1) {
    issues.push({ severity: 'error', message: `duplicate precision mediump float directive detected (${precisionCount})` });
  }

  const mainCount = (fragmentShaderBody.match(/void\s+main\s*\(\s*\)/g) || []).length;
  if (mainCount === 0) {
    issues.push({ severity: 'error', message: 'missing main() function' });
  } else if (mainCount > 1) {
    issues.push({ severity: 'error', message: `multiple main() functions detected (${mainCount})` });
  }

  return issues;
};

const buildErrorSummary = (errors: ShaderValidationIssue[]): string | undefined => {
  if (errors.length === 0) return undefined;
  const first = errors[0];
  const location = first.line ? `line ${first.line}: ` : '';
  return `${location}${first.message}`;
};

const parseWebglLog = (log: string | null): ShaderValidationIssue[] => {
  if (!log) {
    return [{ severity: 'error', message: 'Unknown WebGL compilation error' }];
  }

  return log
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const match = entry.match(/ERROR:\s*\d+:(\d+):\s*(.+)$/i);
      if (match) {
        return {
          severity: 'error' as const,
          line: Number(match[1]),
          message: match[2].trim(),
          code: entry,
        };
      }
      return {
        severity: 'error' as const,
        message: entry,
        code: entry,
      };
    });
};

const parseGlslangLog = (output: string): ShaderValidationIssue[] => {
  return output
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .filter(entry => !/shader\.(frag|vert)$/i.test(entry))
    .filter(entry => !/^glslangvalidator/i.test(entry))
    .filter(entry => !/^warning,/i.test(entry))
    .map(entry => {
      const warningAsErrorMatch = entry.match(/^warning,\s+ERROR:\s*[^:]+:(\d+):\s*(.+)$/i);
      if (warningAsErrorMatch) {
        return {
          severity: 'error' as const,
          line: Number(warningAsErrorMatch[1]),
          message: warningAsErrorMatch[2].trim(),
          code: entry,
        };
      }

      const lineMatch = entry.match(/ERROR:\s*[^:]+:(\d+):\s*(.+)$/i) || entry.match(/:(\d+):\s*(error|warning):\s*(.+)$/i);
      if (lineMatch) {
        const message = lineMatch[2]?.toLowerCase() === 'error' || lineMatch[2]?.toLowerCase() === 'warning'
          ? lineMatch[3].trim()
          : lineMatch[2].trim();
        return {
          severity: 'error' as const,
          line: Number(lineMatch[1]),
          message,
          code: entry,
        };
      }

      return {
        severity: 'error' as const,
        message: entry,
        code: entry,
      };
    });
};

const buildValidationSource = ({ hasWebglIssues, hasHeuristicIssues, hasGlslangIssues, glslangAvailable }: {
  hasWebglIssues: boolean;
  hasHeuristicIssues: boolean;
  hasGlslangIssues: boolean;
  glslangAvailable: boolean;
}): ShaderValidationReport['source'] => {
  if (hasWebglIssues && glslangAvailable) {
    return hasHeuristicIssues || hasGlslangIssues ? 'webgl+glslang+heuristic' : 'webgl+glslang';
  }
  if (glslangAvailable) {
    return hasHeuristicIssues || hasGlslangIssues ? 'glslang+heuristic' : 'glslang';
  }
  if (hasWebglIssues) {
    return hasHeuristicIssues ? 'webgl+heuristic' : 'webgl';
  }
  return hasHeuristicIssues ? 'webgl+heuristic' : 'webgl';
};

export const getShaderValidationReport = (fragmentShaderBody: string): ShaderValidationReport => {
  const heuristicIssues = analyzeShaderStructure(fragmentShaderBody);
  const heuristicErrors = heuristicIssues.filter(issue => issue.severity === 'error');
  const heuristicWarnings = heuristicIssues.filter(issue => issue.severity === 'warning');

  const shouldRunGlslang = hasGlslangValidator();
  const glslangResult = shouldRunGlslang ? validateWithGlslangValidator(fragmentShaderBody, 'frag') : undefined;
  const glslangIssues = glslangResult && !glslangResult.ok ? parseGlslangLog(glslangResult.output) : [];
  const shouldEnforceGlslangFailures = Boolean(glslangResult?.available) && heuristicErrors.length > 0;
  const effectiveGlslangIssues = shouldEnforceGlslangFailures ? glslangIssues : [];

  const gl = getTestContext();
  if (!gl) {
    const errors = [...effectiveGlslangIssues, ...heuristicErrors];
    const report: ShaderValidationReport = {
      valid: errors.length === 0,
      error: buildErrorSummary(errors),
      errors,
      warnings: heuristicWarnings,
      source: glslangResult?.available ? (effectiveGlslangIssues.length > 0 || heuristicErrors.length > 0 || heuristicWarnings.length > 0 ? 'glslang+heuristic' : 'glslang') : 'unavailable',
      glslang: glslangResult,
    };

    shaderDebug.warn('validator', 'WebGL validation unavailable; using fallback validation path', report);
    return report;
  }

  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) {
    const report: ShaderValidationReport = {
      valid: false,
      error: 'Cannot create shader',
      errors: [{ severity: 'error', message: 'Cannot create shader' }, ...heuristicErrors],
      warnings: heuristicWarnings,
      source: heuristicIssues.length > 0 ? 'webgl+heuristic' : 'webgl',
    };

    shaderDebug.error('validator', 'Failed to create test shader', report);
    return report;
  }

  gl.shaderSource(shader, fragmentShaderBody);
  gl.compileShader(shader);

  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const webglIssues = status ? [] : parseWebglLog(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);

  const errors = [...webglIssues, ...effectiveGlslangIssues, ...heuristicErrors];
  const warnings = heuristicWarnings;

  const report: ShaderValidationReport = {
    valid: errors.length === 0,
    error: buildErrorSummary(errors),
    errors,
    warnings,
    source: buildValidationSource({
      hasWebglIssues: webglIssues.length > 0,
      hasHeuristicIssues: heuristicIssues.length > 0,
      hasGlslangIssues: effectiveGlslangIssues.length > 0,
      glslangAvailable: Boolean(glslangResult?.available),
    }),
    glslang: glslangResult,
  };

  if (!report.valid) {
    shaderDebug.warn('validator', 'Shader validation failed', report);
  } else if (warnings.length > 0) {
    shaderDebug.log('validator', 'Shader validation passed with warnings', report);
  }

  return report;
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateGLSL = (fragmentShaderBody: string): ValidationResult => {
  const report = getShaderValidationReport(fragmentShaderBody);
  return {
    valid: report.valid,
    error: report.error,
  };
};
