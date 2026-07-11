/**
 * Build-time version info (see vite.config.ts `define`).
 * __APP_VERSION__/__BUILD_HASH__/__BUILD_DATE__ are string-replaced at build
 * time — there is no runtime cost and no network request.
 */
export const APP_VERSION = __APP_VERSION__;
export const BUILD_HASH = __BUILD_HASH__;
export const BUILD_DATE = __BUILD_DATE__;

/** Short display form, e.g. "v0.1.0 (a1b2c3d)". */
export const VERSION_LABEL = `v${APP_VERSION}${BUILD_HASH !== 'dev' ? ` (${BUILD_HASH})` : ' (dev)'}`;

/** Full tooltip form including the build timestamp, in the user's locale. */
export function versionTooltip(): string {
  const date = new Date(BUILD_DATE);
  const formatted = Number.isNaN(date.getTime()) ? BUILD_DATE : date.toLocaleString();
  return `FlowShader ${VERSION_LABEL}\nBuilt: ${formatted}`;
}
