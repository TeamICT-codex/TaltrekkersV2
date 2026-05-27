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
