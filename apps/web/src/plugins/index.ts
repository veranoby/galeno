// Plugins
import { createVuetify } from 'vuetify';
import { mdi } from 'vuetify/iconsets/mdi';
import '@mdi/font/css/materialdesignicons.css';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

// Vuetify
const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    sets: {
      mdi
    }
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1565C0',
          secondary: '#2E7D32',
          accent: '#FF6F00',
          error: '#C62828',
          warning: '#F57C00',
          info: '#0288D1',
          success: '#2E7D32',
          background: '#FAFAFA',
          surface: '#FFFFFF'
        }
      },
      dark: {
        colors: {
          primary: '#42A5F5',
          secondary: '#66BB6A',
          accent: '#FFA726',
          error: '#EF5350',
          warning: '#FFA726',
          info: '#29B6F6',
          success: '#66BB6A',
          background: '#121212',
          surface: '#1E1E1E'
        }
      }
    }
  },
  defaults: {
    VBtn: {
      style: 'text-transform: none;'
    }
  }
});

// Toastification
const toastOptions = {
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideCloseButton: false,
  toastClassName: 'vue-toastification-custom',
  icon: true,
};

export function registerPlugins(app: any) {
  app.use(vuetify);
  app.use(Toast, toastOptions);
}
