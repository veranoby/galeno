// apps/web/src/state/managers/AuthStateManager.ts
/**
 * AuthStateManager - Gestión centralizada del estado de autenticación
 *
 * Responsabilidades:
 * - Unificar estado disperso en localStorage, Pinia, cache
 * - Implementar patrón Observer con RxJS/BehaviorSubject
 * - Proveer métodos reactivos para componentes Vue 3
 *
 * Patrones aplicados:
 * - Singleton: Una instancia única
 * - Observer Pattern: Notificar cambios a suscriptores
 * - State Manager: Centralizar lógica de auth
 */

import { ref, computed, watch, type Ref } from 'vue';
import type { Router } from 'vue-router';

// ============= TYPES =============

export interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    rol: string;
    nombre: string;
    cuentaId?: string;
  } | null;
  token: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null;
}

export interface AuthLoginCredentials {
  email: string;
  password: string;
}

export interface AuthLogoutOptions {
  navigateToLogin?: boolean;
  reason?: 'user_initiated' | 'session_expired' | 'security';
}

// ============= STATE MANAGER =============

class AuthStateManagerClass {
  // Estado privado reactivo
  private _state: Ref<AuthState>;

  // Suscriptores para cambios de estado
  private subscribers: Set<(state: AuthState) => void> = new Set();

  // Router para navegación
  private router: Router | null = null;

  // Interval ID para cleanup (previene memory leak)
  private tokenCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Inicializar estado desde localStorage si existe
    const savedState = this.loadFromStorage();

    this._state = ref(savedState || {
      isAuthenticated: false,
      user: null,
      token: null
    });

    // Watch para persistir cambios (con debouncing para performance)
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    watch(
      this._state,
      (newState) => {
        // Debounce localStorage writes para performance
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.saveToStorage(newState);
        }, 500); // Debounce 500ms

        this.notifySubscribers(newState);
      },
      { deep: true }
    );

    // Verificar expiración de token periódicamente
    this.startTokenExpirationCheck();
  }

  // ============= PUBLIC API =============

  /**
   * Estado reactivo (para usar en componentes con computed)
   */
  get state(): AuthState {
    return this._state.value;
  }

  /**
   * Computed properties reactivas
   */
  get isAuthenticated() {
    return computed(() => this._state.value.isAuthenticated);
  }

  get user() {
    return computed(() => this._state.value.user);
  }

  get token() {
    return computed(() => this._state.value.token);
  }

  get isAdmin() {
    return computed(() => this._state.value.user?.rol === 'ADMIN');
  }

  get isDoctor() {
    return computed(() => this._state.value.user?.rol === 'DOCTOR');
  }

  get userRole() {
    return computed(() => this._state.value.user?.rol || null);
  }

  /**
   * Inicializar el router
   */
  setRouter(router: Router): void {
    this.router = router;
  }

  /**
   * Login - Actualiza estado con datos de autenticación
   */
  async login(userData: {
    user: AuthState['user'];
    tokens: { accessToken: string; refreshToken: string };
  }): Promise<void> {
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutos

    this._state.value = {
      isAuthenticated: true,
      user: userData.user,
      token: {
        accessToken: userData.tokens.accessToken,
        refreshToken: userData.tokens.refreshToken,
        expiresAt
      }
    };

    // Configurar token en API client
    this.setAuthToken(userData.tokens.accessToken);
  }

  /**
   * Logout - Limpia estado de autenticación
   */
  async logout(options: AuthLogoutOptions = {}): Promise<void> {
    const { navigateToLogin = true, reason = 'user_initiated' } = options;

    this._state.value = {
      isAuthenticated: false,
      user: null,
      token: null
    };

    // Limpiar token en API client
    this.clearAuthToken();

    // Navegar a login si se solicita
    if (navigateToLogin && this.router) {
      this.router.push({
        name: 'login',
        query: reason === 'session_expired' ? { session: 'expired' } : {}
      });
    }
  }

  /**
   * Actualizar datos del usuario
   */
  updateUser(userData: Partial<AuthState['user']>): void {
    if (this._state.value.user) {
      this._state.value.user = {
        ...this._state.value.user,
        ...userData
      } as AuthState['user'];
    }
  }

  /**
   * Verificar si el token está expirado
   */
  isTokenExpired(): boolean {
    const { token } = this._state.value;
    if (!token) return true;
    return Date.now() >= token.expiresAt;
  }

  /**
   * Refrescar token
   */
  async refreshToken(newTokens: { accessToken: string; refreshToken: string }): Promise<void> {
    const expiresAt = Date.now() + (15 * 60 * 1000);

    this._state.value = {
      ...this._state.value,
      token: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt
      }
    };

    this.setAuthToken(newTokens.accessToken);
  }

  /**
   * Suscribirse a cambios de estado
   */
  subscribe(callback: (state: AuthState) => void): () => void {
    this.subscribers.add(callback);

    // Retornar función de unsuscripción
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Verificar autenticación y redirigir si es necesario
   */
  requireAuth(redirectUrl = '/auth/login'): boolean {
    if (!this._state.value.isAuthenticated) {
      if (this.router) {
        this.router.push({
          path: redirectUrl,
          query: { redirect: this.router.currentRoute.value.fullPath }
        });
      }
      return false;
    }
    return true;
  }

  /**
   * Verificar roles requeridos
   */
  hasRole(requiredRoles: string | string[]): boolean {
    const userRole = this._state.value.user?.rol;
    if (!userRole) return false;

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(userRole);
  }

  // ============= PRIVATE METHODS =============

  private loadFromStorage(): AuthState | null {
    try {
      const saved = localStorage.getItem('galeno_auth');
      if (!saved) return null;

      const parsed = JSON.parse(saved);

      // Verificar expiración del token
      if (parsed.token && Date.now() >= parsed.token.expiresAt) {
        this.clearStorage();
        return null;
      }

      return parsed;
    } catch {
      // Ignore errors
    }
    return null;
  }

  private saveToStorage(state: AuthState): void {
    try {
      localStorage.setItem('galeno_auth', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('galeno_auth');
  }

  private setAuthToken(token: string): void {
    // Configurar en API client (axios interceptor)
    if (import.meta.env.VITE_API_URL) {
      // Aquí se configuraría el token en el API client
    }
  }

  private clearAuthToken(): void {
    // Limpiar token en API client
  }

  private notifySubscribers(state: AuthState): void {
    this.subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in auth subscriber:', error);
      }
    });
  }

  private startTokenExpirationCheck(): void {
    // Prevenir múltiples intervals
    if (this.tokenCheckInterval) return;

    // Verificar cada minuto
    this.tokenCheckInterval = setInterval(() => {
      if (this._state.value.isAuthenticated && this.isTokenExpired()) {
        this.logout({
          navigateToLogin: true,
          reason: 'session_expired'
        });
      }
    }, 60 * 1000);
  }

  /**
   * Limpia recursos (para prevenir memory leaks)
   */
  destroy(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
    this.subscribers.clear();
  }
}

// ============= SINGLETON =============

export const AuthStateManager = new AuthStateManagerClass();

// ============= COMPOSABLE PARA VUE =============

/**
 * Composable para usar el AuthStateManager en componentes Vue 3
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAuthManager } from '@/state/managers/AuthStateManager'
 *
 * const { isAuthenticated, user, login, logout } = useAuthManager()
 * </script>
 * ```
 */
export function useAuthManager() {
  return {
    // State reactivo
    state: AuthStateManager.state,
    isAuthenticated: AuthStateManager.isAuthenticated.value,
    user: AuthStateManager.user.value,
    token: AuthStateManager.token.value,
    isAdmin: AuthStateManager.isAdmin.value,
    isDoctor: AuthStateManager.isDoctor.value,
    userRole: AuthStateManager.userRole.value,

    // Métodos
    login: (userData: Parameters<typeof AuthStateManager.login>[0]) =>
      AuthStateManager.login(userData),

    logout: (options?: Parameters<typeof AuthStateManager.logout>[0]) =>
      AuthStateManager.logout(options),

    updateUser: (userData: Parameters<typeof AuthStateManager.updateUser>[0]) =>
      AuthStateManager.updateUser(userData),

    refreshToken: (newTokens: Parameters<typeof AuthStateManager.refreshToken>[0]) =>
      AuthStateManager.refreshToken(newTokens),

    hasRole: (roles: Parameters<typeof AuthStateManager.hasRole>[0]) =>
      AuthStateManager.hasRole(roles),

    requireAuth: (redirectUrl?: string) =>
      AuthStateManager.requireAuth(redirectUrl)
  };
}

export default AuthStateManager;
