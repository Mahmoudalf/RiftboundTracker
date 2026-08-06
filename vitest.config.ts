import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover the pure logic only — legality, deck diffing, analytics, and
 * the API mapper. Anything touching React Native or expo-sqlite is exercised
 * in-app instead; see docs/DATA-MODEL.md §6.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
