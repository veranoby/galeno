import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}', 'tests/load/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/test-utils/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 10000,
    environment: 'node',
    // Usar poolOptions para threads con opciones específicas
    poolOptions: {
      threads: {
        isolate: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    conditions: ['node', 'import', 'require', 'default'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'],
  },
  // Permitir todo el filesystem
  fs: {
    strict: false,
    allow: ['*'],
  },
  // Habilitar optimizador experimental para mejor resolución de módulos
  experimentalBabel: false,
});
