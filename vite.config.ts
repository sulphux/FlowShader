import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
