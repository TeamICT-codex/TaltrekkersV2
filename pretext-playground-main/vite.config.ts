import { defineConfig } from 'vite'

// base: './' zodat dist/ overal als losse subfolder gemount kan worden
// (in TALent voor Taal wordt dat public/reward/ → /reward/reward.html).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        ascii: 'ascii.html',
        rewards: 'rewards.html',
        reward: 'reward.html',
      },
    },
  },
})
