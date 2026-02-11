// ============================================================================
// GALENO DESIGN SYSTEM - Vuetify Configuration
// ============================================================================

/**
 * Design Tokens for Galeno Medical Platform
 *
 * Based on Material Design 3 + Medical UI best practices
 * Color palette inspired by Ecuadorian health sector
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Primary - Medical Blue (Trust, Professionalism)
  primary: {
    base: '#1565C0',
    light: '#42A5F5',
    dark: '#0D47A1',
    contrast: '#FFFFFF'
  },

  // Secondary - Health Green (Growth, Vitality)
  secondary: {
    base: '#2E7D32',
    light: '#66BB6A',
    dark: '#1B5E20',
    contrast: '#FFFFFF'
  },

  // Accent - Medical Orange (Attention, Action)
  accent: {
    base: '#FF6F00',
    light: '#FFA726',
    dark: '#E65100',
    contrast: '#FFFFFF'
  },

  // IA Copilot Chips (from PRD)
  ia: {
    azul: '#1976D2',      // IA suggestion verified
    verde: '#43A047',     // AI verified by human
    amarillo: '#F57C00',  // Requires verification
    rojo: '#C62828'       // Contradicts/needs attention
  },

  // Status Colors
  status: {
    success: '#43A047',
    warning: '#F57C00',
    error: '#C62828',
    info: '#0288D1'
  },

  // Medical Specialties
  specialties: {
    'medicina-general': '#1976D2',
    pediatria: '#EC407A',
    odontologia: '#8E24AA',
    cardiologia: '#E53935',
    oftalmologia: '#43A047',
    dermatologia: '#FB8C00',
    traumatologia: '#5E35B1'
  },

  // Neutrals
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },

  // Semantic
  background: '#FAFAFA',
  surface: '#FFFFFF',
  error: '#C62828',
  warning: '#F57C00',
  info: '#0288D1',
  success: '#2E7D32'
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    base: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    heading: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    mono: "'Roboto Mono', 'Courier New', monospace",
    medical: "'Open Sans', 'Roboto', sans-serif" // Para textos largos médicos
  },

  // Font sizes (rem-based, 1rem = 16px)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem'     // 48px
  },

  // Font weights
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em'
  }
};

// ============================================================================
// SPACING (4px Grid System)
// ============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  7: '1.75rem',  // 28px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
  32: '8rem',    // 128px
  40: '10rem',   // 160px
  48: '12rem',   // 192px
  56: '14rem',   // 224px
  64: '16rem'    // 256px
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px'
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
};

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
  sse: 1090
};

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)'
};

// ============================================================================
// BREAKPOINTS (matches Vuetify defaults)
// ============================================================================

export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
  xxl: 2560
};

// ============================================================================
// VUETIFY THEME CONFIGURATION
// ============================================================================

export const vuetifyThemes = {
  light: {
    dark: false,
    colors: {
      primary: colors.primary.base,
      'primary-dark': colors.primary.dark,
      'primary-light': colors.primary.light,
      secondary: colors.secondary.base,
      'secondary-dark': colors.secondary.dark,
      'secondary-light': colors.secondary.light,
      accent: colors.accent.base,
      error: colors.status.error,
      warning: colors.status.warning,
      info: colors.status.info,
      success: colors.status.success,
      background: colors.background,
      surface: colors.surface,
      'on-primary': colors.primary.contrast,
      'on-secondary': colors.secondary.contrast,
      'on-accent': colors.accent.contrast,
      'on-error': '#FFFFFF',
      'on-warning': '#FFFFFF',
      'on-info': '#FFFFFF',
      'on-success': '#FFFFFF',
      'on-background': colors.gray[900],
      'on-surface': colors.gray[900]
    }
  },
  dark: {
    dark: true,
    colors: {
      primary: colors.primary.light,
      'primary-dark': colors.primary.base,
      'primary-light': '#64B5F6',
      secondary: colors.secondary.light,
      'secondary-dark': colors.secondary.base,
      'secondary-light': '#81C784',
      accent: colors.accent.light,
      error: '#EF5350',
      warning: '#FFA726',
      info: '#29B6F6',
      success: '#66BB6A',
      background: '#121212',
      surface: '#1E1E1E',
      'on-primary': '#FFFFFF',
      'on-secondary': '#FFFFFF',
      'on-accent': '#FFFFFF',
      'on-error': '#FFFFFF',
      'on-warning': '#FFFFFF',
      'on-info': '#FFFFFF',
      'on-success': '#FFFFFF',
      'on-background': '#FFFFFF',
      'on-surface': '#FFFFFF'
    }
  }
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  transitions,
  breakpoints
};

export default designTokens;
