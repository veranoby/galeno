// apps/web/src/state/index.ts
/**
 * Módulo de State Management - Barrel export
 *
 * Provee acceso centralizado a todos los State Managers:
 * - AuthStateManager: Estado de autenticación
 * - NotificationStateManager: Estado de notificaciones
 * - ConsultaStateManager: Estado de consultas
 *
 * Patrones aplicados:
 * - Barrel export: Exportaciones limpias desde un módulo
 * - Singleton: Una instancia única por manager
 * - Composables: API amigable para Vue 3
 */

// State Managers
export { AuthStateManager, useAuthManager } from './managers/AuthStateManager.js';
export { NotificationStateManager, useNotificationManager } from './managers/NotificationStateManager.js';
export { ConsultaStateManager, useConsultaManager } from './managers/ConsultaStateManager.js';

// Types
export type { AuthState, AuthLoginCredentials, AuthLogoutOptions } from './managers/AuthStateManager.js';
export type { AppNotification, NotificationPreferences } from './managers/NotificationStateManager.js';
export type { ConsultaState, ConsultaFilters } from './managers/ConsultaStateManager.js';
