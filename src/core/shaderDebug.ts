export interface ShaderDebugLogger {
  enabled: boolean;
  log: (scope: string, message: string, details?: unknown) => void;
  warn: (scope: string, message: string, details?: unknown) => void;
  error: (scope: string, message: string, details?: unknown) => void;
}

const readDebugFlag = (): boolean => {
  const env = (globalThis as typeof globalThis & {
    importMeta?: { env?: Record<string, string | boolean | undefined> };
    process?: { env?: Record<string, string | undefined> };
  });

  const viteFlag = env.importMeta?.env?.VITE_SHADER_DEBUG;
  if (viteFlag === true || viteFlag === 'true') return true;

  const nodeFlag = env.process?.env?.SHADER_DEBUG;
  return nodeFlag === '1' || nodeFlag === 'true';
};

const emit = (method: 'log' | 'warn' | 'error', scope: string, message: string, details?: unknown) => {
  const prefix = `[ShaderDebug:${scope}] ${message}`;
  if (details === undefined) {
    console[method](prefix);
    return;
  }
  console[method](prefix, details);
};

export const createShaderDebugLogger = (enabled: boolean = readDebugFlag()): ShaderDebugLogger => ({
  enabled,
  log: (scope, message, details) => {
    if (!enabled) return;
    emit('log', scope, message, details);
  },
  warn: (scope, message, details) => {
    if (!enabled) return;
    emit('warn', scope, message, details);
  },
  error: (scope, message, details) => {
    if (!enabled) return;
    emit('error', scope, message, details);
  },
});

export const shaderDebug = createShaderDebugLogger();
