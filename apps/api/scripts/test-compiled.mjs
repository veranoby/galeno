#!/usr/bin/env node
/**
 * Script para ejecutar tests contra código compilado
 *
 * Este script:
 * 1. Compila el código TypeScript a JavaScript
 * 2. Ejecuta Vitest contra el código compilado
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔨 Compilando TypeScript...');
try {
  execSync('npx tsc', {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('✅ Compilación exitosa');
} catch (error) {
  console.error('❌ Error en compilación:', error.message);
  process.exit(1);
}

// Verificar que los archivos compilados existen
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ No se generó el directorio dist/');
  process.exit(1);
}

console.log('🧪 Ejecutando tests contra código compilado...');
try {
  execSync('npx vitest run --config vitest.config.compiled.ts', {
    cwd: rootDir,
    stdio: 'inherit',
  });
} catch (error) {
  console.error('❌ Tests fallaron');
  process.exit(1);
}

console.log('✅ Todos los tests pasaron');
