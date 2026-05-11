// Plugins
import { registerPlugins } from '@/plugins';
import { registerSpecialtyModules } from '@/modules/register';
import App from './App.vue';
import router from '@/router';
import { createPinia } from 'pinia';

// Styles
import '@/styles/main.scss';
import 'vuetify/styles';

// Composables
import { createApp } from 'vue';
import * as Sentry from '@sentry/vue';

// Application
const app = createApp(App);

// Sentry initialization
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

// Pinia store
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// Import auth store after pinia is registered
import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
authStore.init();

// Router
app.use(router);

// Vuetify & other plugins
registerPlugins(app);

// Registrar módulos de especialidad
registerSpecialtyModules();

// Inicializar modo offline
import { setupOfflineMode } from '@/services/offline/setup';
setupOfflineMode().catch(err => {
  console.error('[Main] Offline mode setup failed:', err);
});

// Mount app
app.mount('#app');
