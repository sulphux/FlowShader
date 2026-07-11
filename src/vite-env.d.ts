/// <reference types="vite/client" />

// Wstrzykiwane przez vite.config.ts (`define`) w momencie builda —
// patrz src/core/version.ts
declare const __APP_VERSION__: string;
declare const __BUILD_HASH__: string;
declare const __BUILD_DATE__: string;
