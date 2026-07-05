import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['browser', 'development'],
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
