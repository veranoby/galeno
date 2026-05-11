import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['dist/**/__tests__/**/*.{test,spec}.js', 'dist/**/services/**/__tests__/**/*.js'],
    exclude: ['**/node_modules/**', '**/test-utils/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 10000,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './dist'),
    },
    conditions: ['node', 'import', 'require'],
    extensions: ['.js', '.json'],
  },
});
