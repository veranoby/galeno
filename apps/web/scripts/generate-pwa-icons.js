#!/usr/bin/env node

/**
 * Script de Generación de Iconos PWA
 * 
 * Genera todos los iconos requeridos para PWA incluyendo:
 * - Iconos estándar (192x192, 512x512)
 * - Iconos maskables para Android
 * - Apple Touch Icons para iOS
 * - Favicon y Safari Pinned Tab
 * 
 * Uso:
 *   pnpm generate-icons [ruta-imagen-base]
 * 
 * Ejemplo:
 *   pnpm generate-icons ./src/assets/logo-pwa.png
 * 
 * Requisitos:
 *   - Imagen base mínima: 1024x1024px (recomendado)
 *   - Formato: PNG con fondo transparente
 *   - pwa-asset-generator package instalado
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Colores de la marca Galeno
const BACKGROUND_COLOR = '#ffffff';

/**
 * Tamaños de iconos requeridos
 */
const ICON_SIZES = {
  standard: ['192', '512'],
  apple: ['180', '152', '144', '120', '76'],
  favicon: ['32', '16'],
  splash: ['640', '750', '828', '1125', '1242', '1668', '2048']
};

/**
 * Verifica dependencias requeridas
 */
function checkDependencies() {
  try {
    execSync('pwa-asset-generator --version', { stdio: 'ignore' });
    return true;
  } catch {
    console.error('❌ Error: pwa-asset-generator no está instalado');
    console.error('\nInstalar con:');
    console.error('  pnpm add -D pwa-asset-generator\n');
    return false;
  }
}

/**
 * Verifica que la imagen base existe
 */
function checkSourceImage(sourceImage) {
  if (!existsSync(sourceImage)) {
    console.error(`❌ Error: Imagen base no encontrada: ${sourceImage}`);
    console.error('\nAsegúrate de tener una imagen PNG mínima de 1024x1024px\n');
    return false;
  }
  return true;
}

/**
 * Genera iconos estándar para PWA
 */
function generateStandardIcons(sourceImage) {
  console.log('\n📱 Generando iconos estándar PWA...');
  
  for (const size of ICON_SIZES.standard) {
    const outputFile = join(PUBLIC_DIR, `pwa-${size}x${size}.png`);
    const maskableFile = join(PUBLIC_DIR, `pwa-${size}x${size}-maskable.png`);
    
    try {
      // Icono estándar
      execSync(
        `pwa-asset-generator "${sourceImage}" "${outputFile}" ` +
        `--width ${size} --height ${size} ` +
        `--background "${BACKGROUND_COLOR}" ` +
        `--padding "10%" ` +
        `--type png --silent`,
        { stdio: 'ignore' }
      );
      console.log(`   ✓ pwa-${size}x${size}.png`);
      
      // Icono maskable
      execSync(
        `pwa-asset-generator "${sourceImage}" "${maskableFile}" ` +
        `--width ${size} --height ${size} ` +
        `--background "${BACKGROUND_COLOR}" ` +
        `--padding "0%" ` +
        `--type png --silent`,
        { stdio: 'ignore' }
      );
      console.log(`   ✓ pwa-${size}x${size}-maskable.png`);
    } catch {
      console.error(`   ✗ Error generando icono ${size}x${size}`);
    }
  }
}

/**
 * Genera Apple Touch Icons para iOS
 */
function generateAppleIcons(sourceImage) {
  console.log('\n🍎 Generando Apple Touch Icons...');
  
  for (const size of ICON_SIZES.apple) {
    const outputFile = join(PUBLIC_DIR, `apple-touch-icon-${size}x${size}.png`);
    
    try {
      execSync(
        `pwa-asset-generator "${sourceImage}" "${outputFile}" ` +
        `--width ${size} --height ${size} ` +
        `--background "${BACKGROUND_COLOR}" ` +
        `--padding "10%" ` +
        `--type png --silent`,
        { stdio: 'ignore' }
      );
      console.log(`   ✓ apple-touch-icon-${size}x${size}.png`);
    } catch {
      console.error(`   ✗ Error generando icono ${size}x${size}`);
    }
  }
  
  // Generar apple-touch-icon.png (180x180 por defecto)
  try {
    execSync(
      `pwa-asset-generator "${sourceImage}" "${join(PUBLIC_DIR, 'apple-touch-icon.png')}" ` +
      `--width 180 --height 180 ` +
      `--background "${BACKGROUND_COLOR}" ` +
      `--padding "10%" ` +
      `--type png --silent`,
      { stdio: 'ignore' }
    );
    console.log('   ✓ apple-touch-icon.png (180x180)');
  } catch {
    console.error('   ✗ Error generando apple-touch-icon.png');
  }
}

/**
 * Genera favicons
 */
function generateFavicons(sourceImage) {
  console.log('\n🔖 Generando favicons...');
  
  for (const size of ICON_SIZES.favicon) {
    const outputFile = join(PUBLIC_DIR, `favicon-${size}x${size}.png`);
    
    try {
      execSync(
        `pwa-asset-generator "${sourceImage}" "${outputFile}" ` +
        `--width ${size} --height ${size} ` +
        `--background "${BACKGROUND_COLOR}" ` +
        `--type png --silent`,
        { stdio: 'ignore' }
      );
      console.log(`   ✓ favicon-${size}x${size}.png`);
    } catch {
      console.error(`   ✗ Error generando favicon ${size}x${size}`);
    }
  }
}

/**
 * Genera splash screens para iOS
 */
function generateSplashScreens(sourceImage) {
  console.log('\n🎨 Generando splash screens iOS...');
  
  const splashConfigs = [
    { width: 640, height: 1136, name: 'iphone-5' },
    { width: 750, height: 1334, name: 'iphone-6-7-8' },
    { width: 828, height: 1792, name: 'iphone-xr' },
    { width: 1125, height: 2436, name: 'iphone-x-xs' },
    { width: 1242, height: 2688, name: 'iphone-xs-max' },
    { width: 1668, height: 2388, name: 'ipad-pro' },
    { width: 2048, height: 2732, name: 'ipad-pro-12-9' }
  ];
  
  for (const config of splashConfigs) {
    const outputFile = join(PUBLIC_DIR, `splash-${config.name}.png`);
    
    try {
      execSync(
        `pwa-asset-generator "${sourceImage}" "${outputFile}" ` +
        `--width ${config.width} --height ${config.height} ` +
        `--background "${BACKGROUND_COLOR}" ` +
        `--padding "20%" ` +
        `--type png --silent`,
        { stdio: 'ignore' }
      );
      console.log(`   ✓ splash-${config.name}.png (${config.width}x${config.height})`);
    } catch {
      console.error(`   ✗ Error generando splash ${config.name}`);
    }
  }
}

/**
 * Genera Safari Pinned Tab icon
 */
function generateSafariPinnedTab(/* sourceImage */) {
  console.log('\n🧭 Generando Safari Pinned Tab icon...');
  
  const outputFile = join(PUBLIC_DIR, 'safari-pinned-tab.svg');
  
  try {
    // Crear SVG simple basado en el logo
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <circle cx="90" cy="90" r="80" fill="#1565C0"/>
  <path d="M90 40 L130 90 L90 140 L50 90 Z" fill="white"/>
</svg>`;
    
    // Nota: Para producción, convertir el logo real a SVG monocromático
    execSync(`echo '${svgContent}' > "${outputFile}"`);
    console.log('   ✓ safari-pinned-tab.svg');
  } catch {
    console.error('   ✗ Error generando safari-pinned-tab.svg');
  }
}

/**
 * Muestra instrucciones de uso
 */
function showUsage() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║        Generador de Iconos PWA - Galeno                   ║
╚═══════════════════════════════════════════════════════════╝

Uso:
  pnpm generate-icons [ruta-imagen-base]

Ejemplos:
  pnpm generate-icons ./src/assets/logo-pwa.png
  pnpm generate-icons /path/to/logo.png

Requisitos de la imagen:
  • Formato: PNG con transparencia
  • Tamaño mínimo: 1024x1024px (recomendado)
  • Diseño: Centrado con margen para iconos maskables

Iconos generados:
  • pwa-192x192.png, pwa-512x512.png (Android/Chrome)
  • pwa-*-maskable.png (Android adaptive icons)
  • apple-touch-icon*.png (iOS home screen)
  • favicon-*.png (Browser tabs)
  • splash-*.png (iOS launch screens)
  • safari-pinned-tab.svg (Safari pinned tabs)

Para más información:
  https://github.com/elegantapp/pwa-asset-generator
`);
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2); // eslint-disable-line no-undef
  
  // Mostrar ayuda si no hay argumentos
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(args.length === 0 ? 1 : 0); // eslint-disable-line no-undef
  }
  
  const sourceImage = args[0];
  
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        Generador de Iconos PWA - Galeno                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\nImagen base: ${sourceImage}`);
  
  // Verificar dependencias
  if (!checkDependencies()) {
    process.exit(1); // eslint-disable-line no-undef
  }
  
  // Verificar imagen base
  if (!checkSourceImage(sourceImage)) {
    process.exit(1); // eslint-disable-line no-undef
  }
  
  // Asegurar que el directorio public existe
  if (!existsSync(PUBLIC_DIR)) {
    mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  
  // Generar todos los iconos
  generateStandardIcons(sourceImage);
  generateAppleIcons(sourceImage);
  generateFavicons(sourceImage);
  generateSplashScreens(sourceImage);
  generateSafariPinnedTab(sourceImage);
  
  console.log('\n✅ ¡Iconos generados exitosamente!');
  console.log('\n📁 Archivos creados en:', PUBLIC_DIR);
  console.log('\n⚠️  Recuerda verificar que los iconos se ven correctamente');
  console.log('   y actualizar el manifest.webmanifest si es necesario.\n');
}

main().catch((error) => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1); // eslint-disable-line no-undef
});
