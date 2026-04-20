import { mkdirSync, rmSync, existsSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, resolve } from 'node:path';

const DEST = resolve(process.cwd(), '.tools', 'glslang');
const BIN_DIR = join(DEST, 'bin');

// User must provide URL to a zip containing glslangValidator.exe or glslangValidator
// Example (Khronos glslang release asset URL): https://github.com/KhronosGroup/glslang/releases/download/<tag>/<asset>.zip
const url = process.env.GLSLANG_URL;

if (!url) {
  console.error('Missing GLSLANG_URL env var (direct URL to glslang zip asset).');
  console.error('Example: set GLSLANG_URL=https://.../glslangValidator-<...>.zip');
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(BIN_DIR, { recursive: true });

const zipPath = join(DEST, 'glslang.zip');

console.log('Downloading glslang asset...');
const res = await fetch(url);
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

await pipeline(res.body, createWriteStream(zipPath));

console.log('Downloaded to', zipPath);
console.log('Now extract the zip into', DEST, 'so that', join(BIN_DIR, process.platform === 'win32' ? 'glslangValidator.exe' : 'glslangValidator'), 'exists.');
console.log('NOTE: This script intentionally does not unzip because Node does not include a zip extractor by default.');
console.log('Use PowerShell Expand-Archive on Windows or unzip on Unix, then rerun tests.');
