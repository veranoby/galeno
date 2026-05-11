import { defineConfig, mergeConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import type { UserConfig as VitestUserConfig } from 'vitest/config';

const viteConfig = defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,eot,ttf,json,webp,avif}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_/, /\.[\w-]+(\.[\w-]+)*$/],
        runtimeCaching: [
          // App Shell - Stale While Revalidate for fast loading
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 604800 // 7 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // API Calls - Network First with fallback to cache
          {
            urlPattern: /^https:\/\/api\.galeno\.ec\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400 // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images - Cache First for performance
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 2592000 // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              rangeRequests: true
            }
          },
          // Fonts - Cache First with long expiration
          {
            urlPattern: /\.(?:woff2?|ttf|eot|otf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 31536000 // 1 año
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts - Stale While Revalidate
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 31536000 // 1 año
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Pharmacy Keys - Stale While Revalidate for offline validation
          {
            urlPattern: /\/api\/v1\/pharmacy\/keys/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pharmacy-keys-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 86400 // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB
      },
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html'
      },
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
        'apple-touch-icon-*.png',
        'manifest.webmanifest',
        'safari-pinned-tab.svg',
        'pwa-*.png',
        'splash-*.png'
      ],
      manifest: {
        name: 'Galeno - Ecuador-Health 360',
        short_name: 'Galeno',
        description: 'Plataforma médica integral con IA Copilot y Health Wallet',
        theme_color: '#1565C0',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['health', 'medical', 'lifestyle'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: '/screenshot-narrow.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ],
        shortcuts: [
          {
            name: 'Agendar Cita',
            short_name: 'Cita',
            description: 'Agendar nueva cita médica',
            url: '/citas/nueva',
            icons: [
              {
                src: '/shortcut-cita.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Mis Citas',
            short_name: 'Mis Citas',
            description: 'Ver citas programadas',
            url: '/citas',
            icons: [
              {
                src: '/shortcut-mis-citas.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          }
        ],
        handle_links: 'preferred',
        prefer_related_applications: false
      },
      manifestFilename: 'manifest.webmanifest',
      useCredentials: false,
      injectRegister: 'auto',
      strategies: 'generateSW'
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@galeno/shared-types': fileURLToPath(new URL('../../packages/shared-types/src', import.meta.url)),
      '@galeno/ui-components': fileURLToPath(new URL('../../packages/ui-components/src', import.meta.url)),
      '@galeno/api-client': fileURLToPath(new URL('../../packages/api-client/src', import.meta.url))
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler' // Enable the new SCSS compiler
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'vuetify': ['vuetify'],
          'api': ['@galeno/api-client'],
          'components': ['@galeno/ui-components']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: [
      // Exclude CSS files to prevent import errors in tests
    ],
  }
});

const vitestConfig: VitestUserConfig = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    deps: {
      inline: ['vuetify'], // Inline vuetify to handle its imports properly
    }
  },
};

export default mergeConfig(viteConfig, vitestConfig);
