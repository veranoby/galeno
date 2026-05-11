// apps/web/src/constants/storage.ts
/**
 * Constantes para localStorage
 *
 * Centraliza todas las claves de localStorage y configuraciones
 */

// ============= LOCAL STORAGE KEYS =============
export const STORAGE_KEYS = {
  AUTH: 'galeno_auth',
  NOTIFICATIONS: 'galeno_notifications',
  NOTIFICATION_PREFS: 'galeno_notification_prefs',
  CONSULTAS: 'galeno_consultas',
  USER_PREFERENCES: 'galeno_user_prefs',
  THEME: 'galeno_theme',
  LANGUAGE: 'galeno_language'
} as const;

// ============= STORAGE TIMEOUTS =============
export const STORAGE_TIMEOUTS = {
  DEBOUNCE_SAVE: 500,           // ms - debounce para writes
  SESSION_CHECK: 60 * 1000,      // ms - verificación de sesión
  CACHE_TTL: 5 * 60 * 1000,      // ms - cache por defecto
  LONG_CACHE_TTL: 30 * 60 * 1000 // ms - cache largo
} as const;

// ============= STORAGE LIMITS =============
export const STORAGE_LIMITS = {
  MAX_NOTIFICATIONS: 100,        // máximo de notificaciones a guardar
  MAX_CONSULTAS: 50,             // máximo de consultas en cache
  MAX_LOG_ENTRIES: 50            // máximo de entradas de log
} as const;

// ============= PREFIX PARA KEYS DE TEMPORALES =============
export const TEMP_PREFIX = 'galeno_temp_';
