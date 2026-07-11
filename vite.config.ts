import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev' // brak gita w środowisku builda (np. archiwum bez historii)
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Wersja + hash commita + data builda, wypiekane w momencie `npm run build` —
    // pozwala sprawdzić na żywej stronie, czy serwowany jest aktualny build.
    __APP_VERSION__: JSON.stringify(pkgVersion),
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      output: {
        // Rozdziel duże, rzadko zmieniające się biblioteki na osobne chunki,
        // żeby przeglądarka mogła je cache'ować niezależnie od kodu aplikacji
        manualChunks: {
          three: ['three'],
          reactflow: ['reactflow'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
