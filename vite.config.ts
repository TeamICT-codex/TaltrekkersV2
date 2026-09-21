import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      // De Gemini-SDK hoort NOOIT in de browserbundel: in productie loopt alles via
      // /api/gemini. De dev-tak (callGeminiDirect) is in een productie-build dood,
      // maar Rollup schreef voor de dynamische import toch een verweesd SDK-chunk
      // van 256 KB uit. Als 'external' wordt hij helemaal niet meer gebundeld.
      // scripts/check-bundle.mjs bewaakt dit bij elke build.
      external: ['@google/genai'],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'date-utils': ['date-fns'],
          // @google/genai wordt dynamisch geïmporteerd in dev en is in prod
          // volledig vervangen door de /api/gemini proxy — geen aparte chunk nodig.
        },
      },
    },
  },
});
