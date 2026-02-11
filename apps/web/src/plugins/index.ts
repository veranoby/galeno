// Plugins
import { registerPlugins } from '@/plugins';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { mdi } from 'vuetify/iconsets/mdi';
import '@mdi/font/css/materialdesignicons.css';

// Vuetify
const vuetify = createVuetify({
  components,
  directives,
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

export function registerPlugins(app: any) {
  app.use(vuetify);
}
