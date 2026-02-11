// ============================================================================
// GALENO DESIGN SYSTEM - Vuetify Plugin Configuration
// ============================================================================

import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { mdi } from 'vuetify/iconsets/mdi';
import { vuetifyThemes, designTokens } from './tokens';

// ============================================================================
// VUETIFY PLUGIN
// ============================================================================

export const vuetify = createVuetify({
  components,
  directives,

  // Icons
  icons: {
    defaultSet: 'mdi',
    sets: {
      mdi
    }
  },

  // Themes
  theme: {
    defaultTheme: 'light',
    themes: vuetifyThemes
  },

  // Defaults for components
  defaults: {
    VBtn: {
      style: 'text-transform: none; letter-spacing: normal;',
      color: 'primary',
      variant: 'elevated',
      ripple: true
    },
    VCard: {
      elevation: 2,
      rounded: 'lg'
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto'
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto'
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
      rows: 3
    },
    VCheckbox: {
      color: 'primary',
      hideDetails: 'auto'
    },
    VRadioGroup: {
      color: 'primary'
    },
    VSwitch: {
      color: 'primary',
      hideDetails: 'auto'
    },
    VSlider: {
      color: 'primary',
      thumbSize: 20
    },
    VDatePicker: {
      color: 'primary',
      header: 'primary'
    },
    VNavigationDrawer: {
      elevation: 4
    },
    VAppBar: {
      elevation: 2,
      color: 'primary'
    },
    VDataTable: {
      noDataText: 'No hay datos disponibles',
      loadingText: 'Cargando datos...'
    },
    VPagination: {
      color: 'primary'
    }
  },

  // Global configuration
  display: {
    mobileBreakpoint: 'sm',
    thresholds: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
      xxl: 2560
    }
  }
});

// ============================================================================
// EXPORT
// ============================================================================

export default vuetify;
