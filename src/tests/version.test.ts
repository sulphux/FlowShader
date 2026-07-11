import { describe, it, expect } from 'vitest';
import { APP_VERSION, BUILD_HASH, VERSION_LABEL, versionTooltip } from '../core/version';

describe('version info (baked in at build time via vite.config.ts define)', () => {
  it('exposes the values injected by the build (or the test-config fallback)', () => {
    expect(APP_VERSION).toBe('test');
    expect(BUILD_HASH).toBe('test');
  });

  it('VERSION_LABEL includes the app version and hash', () => {
    expect(VERSION_LABEL).toBe('vtest (test)');
  });

  it('versionTooltip includes the label and a build date line', () => {
    const tooltip = versionTooltip();
    expect(tooltip).toContain(VERSION_LABEL);
    expect(tooltip).toContain('Built:');
  });
});
