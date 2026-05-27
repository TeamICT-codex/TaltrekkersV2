import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: 'src/reward-sdk.ts',
      formats: ['es'],
      fileName: () => 'reward-sdk.js',
    },
    rollupOptions: {
      external: [],
    },
  },
})
