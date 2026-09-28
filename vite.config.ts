import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 8080,
    // Enkel de lokale servers (`npm run dev`, en `npm run preview` erft dit);
    // geen invloed op de productie-build of op Vercel. Met VITE_USE_PROXY=1
    // praat de app in dev via /api/gemini met de lokale proxy (`npm run dev:api`,
    // poort 3001) i.p.v. rechtstreeks met Gemini.
    // 127.0.0.1 i.p.v. localhost: op Windows kan localhost naar IPv6 (::1) wijzen.
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
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
      // Twee pagina's: de app en Sneek (het spel draait in een eigen pagina in
      // een overlay-iframe, zonder React — zo blijft de app-bundel even klein).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        sneek: path.resolve(__dirname, 'sneek.html'),
      },
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
