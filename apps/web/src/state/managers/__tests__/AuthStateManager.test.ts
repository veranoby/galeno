// apps/web/src/state/managers/__tests__/AuthStateManager.test.ts
/**
 * Tests para AuthStateManager
 *
 * Tests de TDD para verificar:
 * - Login/logout functionality
 * - Token expiration
 * - Role verification
 * - localStorage persistence
 * - Subscriber notifications
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthStateManager } from '../AuthStateManager.js';

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

vi.stubGlobal('localStorage', localStorageMock);

describe('AuthStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Limpiar estado después de cada test
    AuthStateManager.logout({ navigateToLogin: false });
  });

  describe('initial state', () => {
    it('should have initial unauthenticated state', () => {
      expect(AuthStateManager.state.isAuthenticated).toBe(false);
      expect(AuthStateManager.state.user).toBeNull();
      expect(AuthStateManager.state.token).toBeNull();
    });
  });

  describe('login', () => {
    it('should update state on login', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      };

      await AuthStateManager.login(userData);

      expect(AuthStateManager.state.isAuthenticated).toBe(true);
      expect(AuthStateManager.state.user).toEqual(userData.user);
      expect(AuthStateManager.state.token?.accessToken).toBe('access-token');
    });

    it('should set token expiration to 15 minutes from now', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      };

      const beforeLogin = Date.now();
      await AuthStateManager.login(userData);
      const afterLogin = Date.now();

      const expiresAt = AuthStateManager.state.token!.expiresAt;
      const expectedMin = beforeLogin + (15 * 60 * 1000);
      const expectedMax = afterLogin + (15 * 60 * 1000);

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should save to localStorage on login', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      };

      await AuthStateManager.login(userData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'galeno_auth',
        expect.stringContaining('user-123')
      );
    });
  });

  describe('logout', () => {
    it('should clear state on logout', async () => {
      // Primero hacer login
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(AuthStateManager.state.isAuthenticated).toBe(true);

      // Luego logout
      await AuthStateManager.logout({ navigateToLogin: false });

      expect(AuthStateManager.state.isAuthenticated).toBe(false);
      expect(AuthStateManager.state.user).toBeNull();
      expect(AuthStateManager.state.token).toBeNull();
    });

    it('should remove from localStorage on logout', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      vi.clearAllMocks();

      await AuthStateManager.logout({ navigateToLogin: false });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('token expiration', () => {
    it('should return true when token is expired', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      // Simular token expirado
      (AuthStateManager as any)._state.value.token.expiresAt = Date.now() - 1000;

      expect(AuthStateManager.isTokenExpired()).toBe(true);
    });

    it('should return false when token is valid', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(AuthStateManager.isTokenExpired()).toBe(false);
    });

    it('should return true when no token exists', () => {
      expect(AuthStateManager.isTokenExpired()).toBe(true);
    });
  });

  describe('role verification', () => {
    it('should return true when user has required role', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'doctor@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(AuthStateManager.hasRole('DOCTOR')).toBe(true);
      expect(AuthStateManager.hasRole(['DOCTOR', 'ADMIN'])).toBe(true);
    });

    it('should return false when user does not have required role', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'doctor@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(AuthStateManager.hasRole('ADMIN')).toBe(false);
      expect(AuthStateManager.hasRole(['ADMIN', 'PACIENTE'])).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      expect(AuthStateManager.hasRole('DOCTOR')).toBe(false);
    });
  });

  describe('user updates', () => {
    it('should update user data', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'old@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Old Name'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      AuthStateManager.updateUser({
        email: 'new@galeno.com',
        nombre: 'Dr. New Name'
      });

      expect(AuthStateManager.state.user?.email).toBe('new@galeno.com');
      expect(AuthStateManager.state.user?.nombre).toBe('Dr. New Name');
      expect(AuthStateManager.state.user?.id).toBe('user-123'); // ID unchanged
    });

    it('should not update user when not authenticated', () => {
      AuthStateManager.updateUser({
        email: 'test@galeno.com'
      });

      expect(AuthStateManager.state.user).toBeNull();
    });
  });

  describe('subscribers', () => {
    it('should notify subscribers on state change', async () => {
      const subscriber = vi.fn();

      AuthStateManager.subscribe(subscriber);

      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(subscriber).toHaveBeenCalled();
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          user: expect.objectContaining({
            id: 'user-123'
          })
        })
      );
    });

    it('should unsubscribe when unsubscribe function is called', async () => {
      const subscriber = vi.fn();

      const unsubscribe = AuthStateManager.subscribe(subscriber);
      unsubscribe();

      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('token refresh', () => {
    it('should update tokens on refresh', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'old-access-token',
          refreshToken: 'old-refresh-token'
        }
      });

      await AuthStateManager.refreshToken({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      expect(AuthStateManager.state.token?.accessToken).toBe('new-access-token');
      expect(AuthStateManager.state.token?.refreshToken).toBe('new-refresh-token');
    });

    it('should update expiration on refresh', async () => {
      await AuthStateManager.login({
        user: {
          id: 'user-123',
          email: 'test@galeno.com',
          rol: 'DOCTOR',
          nombre: 'Dr. Test'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      const oldExpiresAt = AuthStateManager.state.token!.expiresAt;

      // Esperar un poco para asegurar diferencia
      await new Promise(resolve => setTimeout(resolve, 10));

      await AuthStateManager.refreshToken({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      const newExpiresAt = AuthStateManager.state.token!.expiresAt;

      expect(newExpiresAt).toBeGreaterThan(oldExpiresAt);
    });
  });
});
