/**
 * Pharmacy Role Guard Middleware Tests
 * TASK-019: Validación QR Farmacias
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import {
  pharmacyRoleGuard,
  requirePharmacyRole,
  PharmacyRoleGuardError,
  PharmacyAuthRequest
} from '../pharmacy-role-guard.js';

describe('Pharmacy Role Guard Middleware', () => {
  let mockReq: Partial<PharmacyAuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: undefined
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockNext = vi.fn();
  });

  describe('pharmacyRoleGuard', () => {
    it('should reject request without authenticated user', async () => {
      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required for pharmacy access'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with non-pharmacy role', async () => {
      mockReq.user = {
        id: 'user-123',
        email: 'doctor@example.com',
        rol: 'DOCTOR',
        cuentaId: 'cuenta-456'
      };

      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access restricted to FARMACIA role only',
        requiredRole: 'FARMACIA',
        userRole: 'DOCTOR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with ADMIN role', async () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        rol: 'ADMIN',
        cuentaId: 'cuenta-456'
      };

      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access restricted to FARMACIA role only',
        requiredRole: 'FARMACIA',
        userRole: 'ADMIN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow request with FARMACIA role', async () => {
      mockReq.user = {
        id: 'pharmacy-123',
        email: 'pharmacy@example.com',
        rol: 'FARMACIA',
        cuentaId: 'cuenta-456'
      };

      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should set pharmacy context for FARMACIA role', async () => {
      mockReq.user = {
        id: 'pharmacy-123',
        email: 'pharmacy@example.com',
        rol: 'FARMACIA',
        cuentaId: 'cuenta-456'
      };

      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect((mockReq as PharmacyAuthRequest).pharmacyContext).toEqual({
        pharmacyId: 'pharmacy-123',
        pharmacyEmail: 'pharmacy@example.com',
        cuentaId: 'cuenta-456'
      });
    });

    it('should handle case-insensitive role comparison', async () => {
      mockReq.user = {
        id: 'pharmacy-123',
        email: 'pharmacy@example.com',
        rol: 'farmacia' as any, // lowercase
        cuentaId: 'cuenta-456'
      };

      await pharmacyRoleGuard(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requirePharmacyRole', () => {
    it('should create middleware that requires FARMACIA role', () => {
      const middleware = requirePharmacyRole();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should allow FARMACIA role when using requirePharmacyRole', async () => {
      const middleware = requirePharmacyRole();
      
      mockReq.user = {
        id: 'pharmacy-123',
        email: 'pharmacy@example.com',
        rol: 'FARMACIA',
        cuentaId: 'cuenta-456'
      };

      await middleware(mockReq as PharmacyAuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('PharmacyRoleGuardError', () => {
    it('should create error with correct properties', () => {
      const error = new PharmacyRoleGuardError('Access denied', 'UNAUTHORIZED', 401);

      expect(error.name).toBe('PharmacyRoleGuardError');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should default to FORBIDDEN code and 403 status', () => {
      const error = new PharmacyRoleGuardError('Role not allowed');

      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });
  });
});
