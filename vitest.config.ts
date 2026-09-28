import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The default is 5s, which the UK fee-page tests sit right on: they render
    // the full 347-row table, five times over, and a large suite running in
    // parallel pushes a single render past 5s. That is a load artefact, not a
    // real assertion failure, and a flaky test is worse than a slow one because
    // it trains you to ignore a red suite.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});