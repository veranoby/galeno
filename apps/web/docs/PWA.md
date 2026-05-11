# PWA - Aplicación Web Progresiva (Galeno)

## Descripción

Galeno está implementado como una **Progressive Web App (PWA)** que ofrece:

- ✅ Instalación nativa en dispositivos móviles y desktop
- ✅ Funcionamiento offline con caché inteligente
- ✅ Notificaciones push (próximamente)
- ✅ Actualizaciones automáticas del service worker
- ✅ Score Lighthouse PWA > 90

---

## Arquitectura PWA

```
apps/web/
├── public/
│   ├── manifest.webmanifest      # Manifesto PWA
│   ├── apple-touch-icon.png      # Icono iOS (180x180)
│   ├── apple-touch-icon-*.png    # Iconos iOS múltiples tamaños
│   ├── pwa-192x192.png           # Icono Android (192x192)
│   ├── pwa-512x512.png           # Icono Android (512x512)
│   ├── pwa-*-maskable.png        # Iconos maskables Android
│   ├── favicon-*.png             # Favicons múltiples tamaños
│   ├── safari-pinned-tab.svg     # Safari pinned tab
│   ├── splash-*.png              # Splash screens iOS
│   └── browserconfig.xml         # Configuración Microsoft
├── src/
│   ├── composables/
│   │   └── usePWA.ts             # Composable PWA reutilizable
│   ├── components/pwa/
│   │   ├── PWAInstallPrompt.vue  # Prompt de instalación
│   │   └── PWASettings.vue       # Configuración PWA
│   └── views/pwa/
│       └── OfflineView.vue       # Página offline
├── scripts/
│   └── generate-pwa-icons.js     # Script generación iconos
├── index.html                    # Meta tags PWA
└── vite.config.ts                # Configuración VitePWA
```

---

## Generación de Iconos

### Requisitos

- **Imagen base**: PNG mínimo 1024x1024px con transparencia
- **Package**: `pwa-asset-generator` (instalado como devDependency)

### Comandos

```bash
# Generar todos los iconos PWA
pnpm generate-icons ./src/assets/logo-pwa.png

# Con ruta absoluta
pnpm generate-icons /path/to/logo.png
```

### Iconos Generados

| Archivo | Tamaño | Propósito |
|---------|--------|-----------|
| `pwa-192x192.png` | 192x192 | Android home screen |
| `pwa-512x512.png` | 512x512 | Android home screen (alta resolución) |
| `pwa-*-maskable.png` | Varios | Android adaptive icons |
| `apple-touch-icon.png` | 180x180 | iOS home screen (default) |
| `apple-touch-icon-*.png` | Varios | iOS home screen (múltiples dispositivos) |
| `favicon-*.png` | 32, 16 | Browser tabs |
| `splash-*.png` | Varios | iOS launch screens |
| `safari-pinned-tab.svg` | SVG | Safari pinned tabs |

---

## Composable usePWA

### Uso

```ts
import { usePWA } from '@/composables/usePWA'

const {
  isPWAInstalled,    // boolean - ¿Está instalada como PWA?
  isInstallable,     // boolean - ¿Se puede instalar?
  isOnline,          // boolean - ¿Hay conexión?
  offlineMode,       // boolean - ¿Modo offline activo?
  appVersion,        // string - Versión de la app
  promptInstall,     // () => Promise - Mostrar prompt instalación
  resetInstallable,  // () => void - Resetear estado instalable
  markInstallDismissed,  // () => void - Marcar como dismissado
  clearInstallDismissed  // () => void - Limpiar dismiss
} = usePWA()
```

### Ejemplo en Componente

```vue
<script setup lang="ts">
import { usePWA } from '@/composables/usePWA'

const { isPWAInstalled, isInstallable, promptInstall } = usePWA()

async function handleInstall() {
  const result = await promptInstall()
  if (result?.outcome === 'accepted') {
    console.log('Instalación aceptada')
  }
}
</script>

<template>
  <v-btn
    v-if="isInstallable && !isPWAInstalled"
    @click="handleInstall"
  >
    Instalar App
  </v-btn>
</template>
```

---

## Componentes PWA

### PWAInstallPrompt.vue

Prompt automático de instalación que:

- Se muestra después de 3 segundos de navegación
- Detecta si el navegador soporta instalación
- Respeta dismiss del usuario (7 días)
- Accesibilidad WCAG 2.1 AA

```vue
<template>
  <PWAInstallPrompt />
</template>
```

### PWASettings.vue

Panel de configuración PWA para settings:

- Estado de instalación
- Estado de conexión
- Versión de la app
- Botón de actualización

```vue
<template>
  <PWASettings />
</template>
```

### OfflineView.vue

Página de fallback offline:

- UI amigable sin conexión
- Lista de funcionalidades disponibles
- Botón de reintento
- Auto-redirect al recuperar conexión

**Ruta**: `/offline`

---

## Configuración VitePWA

### vite.config.ts

```ts
VitePWA({
  registerType: 'prompt',  // Control manual de updates
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,eot,ttf,json,webp,avif}'],
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: false,  // No auto-activar nuevo SW
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
  },
  manifest: {
    name: 'Galeno - Ecuador-Health 360',
    short_name: 'Galeno',
    display: 'standalone',
    theme_color: '#1565C0',
    background_color: '#ffffff',
    // ... más configuración
  }
})
```

### Estrategias de Caché

| Tipo | Estrategia | Duración |
|------|------------|----------|
| CDN (jsdelivr) | StaleWhileRevalidate | 7 días |
| API | NetworkFirst | 24 horas |
| Imágenes | CacheFirst | 30 días |
| Fuentes | CacheFirst | 1 año |

---

## Checklist Lighthouse PWA (> 90)

### Manifest ✅

- [x] `name` y `short_name` definidos
- [x] `start_url` absoluto
- [x] `display: standalone`
- [x] `theme_color` y `background_color`
- [x] Iconos 192x192 y 512x512
- [x] Iconos maskables
- [x] `scope` definido

### Service Worker ✅

- [x] Registrado con `registerType: 'prompt'`
- [x] `clientsClaim: true`
- [x] `skipWaiting: false` (control manual)
- [x] Offline fallback configurado
- [x] Runtime caching strategies

### Meta Tags ✅

- [x] `viewport` con `user-scalable=no`
- [x] `theme-color` (light y dark)
- [x] `apple-mobile-web-app-capable`
- [x] `apple-touch-icon` (180x180 mínimo)
- [x] `apple-mobile-web-app-status-bar-style`
- [x] `mask-icon` para Safari

### HTTPS ⚠️

- [ ] Redirect HTTP → HTTPS (infraestructura)
- [ ] Certificado SSL válido

### Accesibilidad ✅

- [x] Labels en botones
- [x] Roles ARIA
- [x] Focus management
- [x] Contraste de colores

---

## Testing PWA

### Chrome DevTools

1. Abrir DevTools → Application
2. Verificar Manifest
3. Verificar Service Worker
4. Simular offline
5. Probar instalación

### Lighthouse

```bash
# CLI
lighthouse http://localhost:5173 --category=pwa --output=html

# O usar DevTools → Lighthouse → PWA
```

### Comandos Útiles

```bash
# Build de producción
pnpm build

# Preview build
pnpm preview

# Test PWA en producción local
pnpm build && pnpm preview
```

---

## Actualizaciones

El service worker usa `registerType: 'prompt'`:

1. **Detección**: App detecta nuevo SW disponible
2. **Notificación**: Snackbar "Nueva versión disponible"
3. **Actualización**: Usuario hace click en "Actualizar"
4. **Recarga**: Página se recarga con nueva versión

### Forzar Update

```ts
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { updateServiceWorker } = useRegisterSW()

// Llamar cuando usuario acepta actualizar
await updateServiceWorker()
```

---

## Troubleshooting

### PWA no se instala

1. Verificar HTTPS (requerido en producción)
2. Verificar manifest.webmanifest accesible
3. Verificar iconos existen en /public
4. Limpiar caché del navegador

### Service Worker no actualiza

1. Forzar skipWaiting en DevTools
2. Limpiar Application Storage
3. Verificar `skipWaiting: false` en config

### Iconos no muestran

1. Ejecutar `pnpm generate-icons`
2. Verificar rutas en manifest.webmanifest
3. Clear cache del navegador

---

## Referencias

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web App Manifest](https://web.dev/add-manifest/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Lighthouse PWA Audit](https://web.dev/measure/)
