import { defineStore } from 'pinia';
import { apiClient } from '@/services/api';
import { logger } from '@/utils/logger';

export interface User {
  id: string;
  email: string;
  rol: string;
  nombre: string;
  cuentaId?: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null') as User | null,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    isAdmin: (state) => state.user?.rol === 'ADMIN',
    isDoctor: (state) => state.user?.rol === 'DOCTOR',
    isAssistant: (state) => state.user?.rol === 'ASISTENTE' || state.user?.rol === 'ENFERMERA',
  },

  actions: {
    async login(credentials: { email: string; password: any }) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await apiClient.post<any>('/auth/login', credentials);
        
        if (response.success && response.data) {
          const { user, tokens } = response.data;
          this.setSession(user, tokens.accessToken, tokens.refreshToken);
          return response.data;
        } else {
          this.error = response.error || 'Error al iniciar sesión';
          throw new Error(this.error);
        }
      } catch (error: any) {
        logger.error('Login failed', { error });
        this.error = error.message || 'Error al iniciar sesión';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setSession(user: User, accessToken: string, refreshToken: string) {
      this.user = user;
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      apiClient.setToken(accessToken);
      logger.setUser(user);
    },

    logout() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      apiClient.clearToken();
      logger.setUser(null);
    },

    async init() {
      if (this.accessToken) {
        apiClient.setToken(this.accessToken);
        if (this.user) {
          logger.setUser(this.user);
        }
      }
    }
  },
  persist: true
});
