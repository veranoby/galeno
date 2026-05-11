import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireResourceAccess } from '../../src/middleware/resource-access-control';
import { EnhancedPermissionService } from '../../src/services/auth/enhanced-permissions.service';
import { Request, Response, NextFunction } from 'express';

// Mock the EnhancedPermissionService
vi.mock('../../src/services/auth/enhanced-permissions.service', () => ({
  EnhancedPermissionService: {
    canAccessResource: vi.fn(),
  },
}));

describe('Resource Access Control Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      params: {},
      user: { id: 'test-user-id', email: 'test@example.com', rol: 'DOCTOR' }
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next if user has access to resource', async () => {
    // Mock that user has access to the resource
    vi.spyOn(EnhancedPermissionService, 'canAccessResource')
      .mockResolvedValue(true);

    const middleware = requireResourceAccess('paciente', 'pacienteId');
    mockReq.params = { pacienteId: 'test-paciente-id' };

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 403 if user does not have access to resource', async () => {
    // Mock that user does not have access to the resource
    vi.spyOn(EnhancedPermissionService, 'canAccessResource')
      .mockResolvedValue(false);

    const middleware = requireResourceAccess('paciente', 'pacienteId');
    mockReq.params = { pacienteId: 'test-paciente-id' };

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockReq.user = undefined; // No authenticated user

    const middleware = requireResourceAccess('paciente', 'pacienteId');
    mockReq.params = { pacienteId: 'test-paciente-id' };

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required for resource access check'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 if resource ID parameter is missing', async () => {
    // Mock that user has access to the resource
    vi.spyOn(EnhancedPermissionService, 'canAccessResource')
      .mockResolvedValue(true);

    const middleware = requireResourceAccess('paciente', 'pacienteId');
    mockReq.params = {}; // Missing pacienteId parameter

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'Resource ID parameter \'pacienteId\' is required'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});