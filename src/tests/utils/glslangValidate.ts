import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export type GLSLStage = 'frag' | 'vert';

function localGlslangValidatorPath(): string | null {
  const exe = process.platform === 'win32' ? 'glslangValidator.exe' : 'glslangValidator';
  const p = resolve(process.cwd(), '.tools', 'glslang', 'bin', exe);
  return existsSync(p) ? p : null;
}

export function glslangValidatorCmd(): string {
  return localGlslangValidatorPath() ?? 'glslangValidator';
}

export function hasGlslangValidator(): boolean {
  try {
    const res = spawnSync(glslangValidatorCmd(), ['--version'], { encoding: 'utf8' });
    return res.status === 0;
  } catch {
    return false;
  }
}

export function validateWithGlslangValidator(source: string, stage: GLSLStage = 'frag'): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'nodeshader-glsl-'));
  const file = join(dir, stage === 'frag' ? 'shader.frag' : 'shader.vert');

  try {
    writeFileSync(file, source, 'utf8');

    const args = ['-S', stage, file];
    const out = execFileSync(glslangValidatorCmd(), args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    return { ok: true, output: out };
  } catch (e: any) {
    const output = [e?.stdout, e?.stderr].filter(Boolean).join('\n');
    return { ok: false, output };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
