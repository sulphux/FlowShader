import { shaderDebug } from './shaderDebug';

// glslangValidator wymaga procesów i systemu plików, więc działa tylko w Node
// (vitest/CLI). W przeglądarce moduły node:* są niedostępne — importujemy je
// dynamicznie i tylko wtedy, gdy faktycznie jesteśmy w Node.
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

interface NodeDeps {
  execFileSync: typeof import('node:child_process')['execFileSync'];
  spawnSync: typeof import('node:child_process')['spawnSync'];
  existsSync: typeof import('node:fs')['existsSync'];
  mkdtempSync: typeof import('node:fs')['mkdtempSync'];
  rmSync: typeof import('node:fs')['rmSync'];
  writeFileSync: typeof import('node:fs')['writeFileSync'];
  tmpdir: typeof import('node:os')['tmpdir'];
  join: typeof import('node:path')['join'];
  resolve: typeof import('node:path')['resolve'];
}

let nodeDeps: NodeDeps | null = null;

if (isNode) {
  const [cp, fs, os, path] = await Promise.all([
    import('node:child_process'),
    import('node:fs'),
    import('node:os'),
    import('node:path'),
  ]);
  nodeDeps = {
    execFileSync: cp.execFileSync,
    spawnSync: cp.spawnSync,
    existsSync: fs.existsSync,
    mkdtempSync: fs.mkdtempSync,
    rmSync: fs.rmSync,
    writeFileSync: fs.writeFileSync,
    tmpdir: os.tmpdir,
    join: path.join,
    resolve: path.resolve,
  };
}

export type GLSLStage = 'frag' | 'vert';

export interface GlslangValidationResult {
  available: boolean;
  ok: boolean;
  output: string;
  command?: string;
}

function localGlslangValidatorPath(): string | null {
  if (!nodeDeps) return null;
  const exe = process.platform === 'win32' ? 'glslangValidator.exe' : 'glslangValidator';
  const path = nodeDeps.resolve(process.cwd(), '.tools', 'glslang', 'bin', exe);
  return nodeDeps.existsSync(path) ? path : null;
}

export function glslangValidatorCmd(): string {
  return localGlslangValidatorPath() ?? 'glslangValidator';
}

export function hasGlslangValidator(): boolean {
  if (!nodeDeps) return false;
  try {
    const result = nodeDeps.spawnSync(glslangValidatorCmd(), ['--version'], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function validateWithGlslangValidator(source: string, stage: GLSLStage = 'frag'): GlslangValidationResult {
  const command = glslangValidatorCmd();
  if (!nodeDeps || !hasGlslangValidator()) {
    return {
      available: false,
      ok: false,
      output: 'glslangValidator is not available',
      command,
    };
  }

  const { mkdtempSync, join, tmpdir, writeFileSync, execFileSync, rmSync } = nodeDeps;
  const dir = mkdtempSync(join(tmpdir(), 'nodeshader-glsl-'));
  const file = join(dir, stage === 'frag' ? 'shader.frag' : 'shader.vert');

  try {
    writeFileSync(file, source, 'utf8');
    const args = ['-S', stage, file];
    const output = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      available: true,
      ok: true,
      output,
      command,
    };
  } catch (error: any) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).join('\n');
    shaderDebug.warn('glslang', 'glslangValidator rejected shader', { command, stage, output });
    return {
      available: true,
      ok: false,
      output,
      command,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
