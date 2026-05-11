/**
 * Pharmacy Routes Tests
 * TASK-019: Validación QR Farmacias
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import pharmacyRoutes from '../pharmacy.routes.js';
import { AuthRequest } from '../../../middleware/auth.js';

// Mock pharmacy service
vi.mock('../../../services/pharmacy/qr-validation.service.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    validatePharmacyQR: vi.fn(),
    getLimitedPatientInfo: vi.fn()
  }))
}));

// Mock database
vi.mock('../../../config/database.js', () => ({
  default: {
    $executeRaw: vi.fn()
  }
}));

describe('Pharmacy Routes', () => {
  let app: express.Express;
  let mockValidateQR: any;
  let mockGetLimitedPatientInfo: any;

  beforeAll(async () => {
    // Set required env vars
    process.env.QR_SECRET = 'test-qr-secret-key-for-pharmacy-validation-32bytes';
  });

  afterAll(() => {
    delete process.env.QR_SECRET;
  });

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Mock auth middleware bypass for testing
    const mockAuthMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      if ((req as any).mockUser) {
        req.user = (req as any).mockUser;
      }
      next();
    };

    // Import and use routes with mock auth
    const { default: pharmacyRoutesModule } = await import('../pharmacy.routes.js');
    app.use('/pharmacy', mockAuthMiddleware, pharmacyRoutesModule);

    // Get mocked service methods
    const PharmacyQRValidationService = (await import('../../../services/pharmacy/qr-validation.service.js')).default;
    const serviceInstance = new PharmacyQRValidationService({} as any);
    mockValidateQR = serviceInstance.validatePharmacyQR;
    mockGetLimitedPatientInfo = serviceInstance.getLimitedPatientInfo;
  });

  describe('POST /pharmacy/validate-qr', () => {
    const validPharmacyUser = {
      id: 'pharmacy-123',
      email: 'pharmacy@example.com',
      rol: 'FARMACIA',
      cuentaId: 'cuenta-456'
    };

    const invalidUser = {
      id: 'doctor-123',
      email: 'doctor@example.com',
      rol: 'DOCTOR',
      cuentaId: 'cuenta-456'
    };

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/pharmacy/validate-qr')
        .send({ qrData: 'test-qr-data' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request with non-pharmacy role', async () => {
      const response = await request(app)
        .post('/pharmacy/validate-qr')
        .set('Authorization', 'Bearer token')
        .send({ qrData: 'test-qr-data' })
        .set('mock-user', JSON.stringify(invalidUser));

      // Apply mock user
      (app as any)._router.handle = vi.fn().mockImplementation((req, res, next) => {
        (req as any).mockUser = invalidUser;
        next();
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('FARMACIA');
    });

    it('should reject request with missing qrData', async () => {
      const response = await request(app)
        .post('/pharmacy/validate-qr')
        .set('Authorization', 'Bearer token')
        .send({})
        .set('mock-user', JSON.stringify(validPharmacyUser));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('qrData');
    });

    it('should successfully validate QR and return limited patient info', async () => {
      mockValidateQR.mockResolvedValue({
        isValid: true,
        wallet: { walletId: 'wallet-123', pacienteId: 'paciente-456' },
        paciente: { id: 'paciente-456', nombre: 'John Doe' },
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockGetLimitedPatientInfo.mockResolvedValue({
        id: 'paciente-456',
        nombre: 'John Doe',
        cedula: '1234567890',
        fechaNacimiento: new Date('1990-01-01'),
        email: 'john@example.com',
        telefono: '+593999999999'
      });

      const response = await request(app)
        .post('/pharmacy/validate-qr')
        .set('Authorization', 'Bearer token')
        .send({ qrData: 'valid-qr-data' })
        .set('mock-user', JSON.stringify(validPharmacyUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.patientInfo).toBeDefined();
      expect(response.body.data.patientInfo.id).toBe('paciente-456');
    });

    it('should handle QR validation errors', async () => {
      mockValidateQR.mockRejectedValue(new Error('QR expired'));

      const response = await request(app)
        .post('/pharmacy/validate-qr')
        .set('Authorization', 'Bearer token')
        .send({ qrData: 'expired-qr-data' })
        .set('mock-user', JSON.stringify(validPharmacyUser));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });
  });

  describe('GET /pharmacy/patient/:id', () => {
    const validPharmacyUser = {
      id: 'pharmacy-123',
      email: 'pharmacy@example.com',
      rol: 'FARMACIA',
      cuentaId: 'cuenta-456'
    };

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/pharmacy/patient/paciente-123');

      expect(response.status).toBe(401);
    });

    it('should reject request with non-pharmacy role', async () => {
      const response = await request(app)
        .get('/pharmacy/patient/paciente-123')
        .set('Authorization', 'Bearer token')
        .set('mock-user', JSON.stringify({
          id: 'doctor-123',
          email: 'doctor@example.com',
          rol: 'DOCTOR'
        }));

      expect(response.status).toBe(403);
    });

    it('should return limited patient information', async () => {
      mockGetLimitedPatientInfo.mockResolvedValue({
        id: 'paciente-456',
        nombre: 'John Doe',
        cedula: '1234567890',
        fechaNacimiento: new Date('1990-01-01'),
        email: 'john@example.com',
        telefono: '+593999999999'
      });

      const response = await request(app)
        .get('/pharmacy/patient/paciente-456')
        .set('Authorization', 'Bearer token')
        .set('mock-user', JSON.stringify(validPharmacyUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('paciente-456');
      expect(response.body.data.nombre).toBe('John Doe');
    });

    it('should return 404 for non-existent patient', async () => {
      mockGetLimitedPatientInfo.mockResolvedValue(null);

      const response = await request(app)
        .get('/pharmacy/patient/non-existent')
        .set('Authorization', 'Bearer token')
        .set('mock-user', JSON.stringify(validPharmacyUser));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Patient not found');
    });
  });
});
