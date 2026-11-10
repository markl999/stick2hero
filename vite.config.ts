import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build can be hosted from any static path.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
