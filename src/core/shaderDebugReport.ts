import type { ShaderValidationIssue, ShaderValidationReport } from './validator';

const formatIssue = (issue: ShaderValidationIssue): string => {
  const location = issue.line ? `L${issue.line}: ` : '';
  const code = issue.code ? ` [${issue.code}]` : '';
  return `${location}${issue.message}${code}`;
};

export interface ShaderDebugReportSections {
  summary: string;
  errors: string[];
  warnings: string[];
  sources: string[];
  glslangOutput?: string;
}

export const buildShaderDebugReport = (report: ShaderValidationReport): ShaderDebugReportSections => {
  const errors = report.errors.map(formatIssue);
  const warnings = report.warnings.map(formatIssue);

  const sources = [
    `validation-source: ${report.source}`,
    report.glslang?.available
      ? `glslang: ${report.glslang.ok ? 'ok' : 'failed'}${report.glslang.command ? ` (${report.glslang.command})` : ''}`
      : 'glslang: unavailable',
  ];

  const summaryParts = [
    report.valid ? 'Shader validation passed' : 'Shader validation failed',
    `errors=${report.errors.length}`,
    `warnings=${report.warnings.length}`,
  ];

  return {
    summary: summaryParts.join(' | '),
    errors,
    warnings,
    sources,
    glslangOutput: report.glslang?.output?.trim() || undefined,
  };
};

export const buildShaderDebugText = (report: ShaderValidationReport): string => {
  const sections = buildShaderDebugReport(report);
  const lines = [sections.summary, ...sections.sources];

  if (sections.errors.length > 0) {
    lines.push('Errors:');
    lines.push(...sections.errors.map(error => `- ${error}`));
  }

  if (sections.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...sections.warnings.map(warning => `- ${warning}`));
  }

  if (sections.glslangOutput) {
    lines.push('glslang output:');
    lines.push(sections.glslangOutput);
  }

  return lines.join('\n');
};
