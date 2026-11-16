import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  }
});
