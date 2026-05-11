/**
 * Tests unitarios para QRService
 * TASK-008C: Validación QR Health Wallet
 *
 * Flujo TDD: Tests escritos para validar generación y validación de QR
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import QRService from '../qr-service';
import QRCode from 'qrcode';

// Mock de Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock de qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock-qr-data')),
  },
}));

// Mock de auditLog
vi.mock('../../audit/audit-log', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('QRService', () => {
  let service: QRService;
  let mockPrisma: any;

  beforeEach(() => {
    // Setup mock de Prisma
    mockPrisma = {
      healthWallet: {
        findUnique: vi.fn(),
      },
    };

    // Mock PrismaClient constructor
    (PrismaClient as unknown as any).mockImplementation(() => mockPrisma);

    service = new QRService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateWalletQR', () => {
    it('debe generar un QR code para un wallet activo', async () => {
      const pacienteId = 'test-paciente-id';
      const walletId = 'wallet-123';

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId,
        walletId,
        version: 1,
        activo: true,
      });

      const result = await service.generateWalletQR({ pacienteId });

      expect(result).toBe('data:image/png;base64,mock-qr-data');
      expect(QRCode.toDataURL).toHaveBeenCalled();
      expect(mockPrisma.healthWallet.findUnique).toHaveBeenCalledWith({
        where: { pacienteId },
      });
    });

    it('debe lanzar error si el wallet no existe', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue(null);

      await expect(
        service.generateWalletQR({ pacienteId: 'non-existent' })
      ).rejects.toThrow('Wallet not found or inactive');
    });

    it('debe lanzar error si el wallet está inactivo', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId: 'wallet-123',
        activo: false, // Inactivo
      });

      await expect(
        service.generateWalletQR({ pacienteId: 'test-paciente-id' })
      ).rejects.toThrow('Wallet not found or inactive');
    });

    it('debe incluir firma y expiración en los datos del QR', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId: 'wallet-123',
        version: 1,
        activo: true,
      });

      await service.generateWalletQR({ pacienteId: 'test-paciente-id' });

      // Verificar que se llamó a QRCode.toDataURL con datos que incluyen
      // walletId, timestamp, expirationTime, signature, y version
      const qrCall = (QRCode.toDataURL as any).mock.calls[0][0];
      const qrData = JSON.parse(qrCall);

      expect(qrData).toHaveProperty('walletId');
      expect(qrData).toHaveProperty('timestamp');
      expect(qrData).toHaveProperty('expirationTime');
      expect(qrData).toHaveProperty('signature');
      expect(qrData).toHaveProperty('version');
      expect(qrData.walletId).toBe('wallet-123');
      expect(qrData.version).toBe(1);
    });

    it('debe establecer expiración de 24 horas', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId: 'wallet-123',
        version: 1,
        activo: true,
      });

      const beforeTime = Date.now();
      await service.generateWalletQR({ pacienteId: 'test-paciente-id' });
      const afterTime = Date.now();

      const qrCall = (QRCode.toDataURL as any).mock.calls[0][0];
      const qrData = JSON.parse(qrCall);

      // Verificar que expirationTime es aproximadamente 24 horas después del timestamp
      const expectedMinExpiration = qrData.timestamp + (24 * 60 * 60 * 1000) - 1000;
      const expectedMaxExpiration = qrData.timestamp + (24 * 60 * 60 * 1000) + 1000;

      expect(qrData.expirationTime).toBeGreaterThanOrEqual(expectedMinExpiration);
      expect(qrData.expirationTime).toBeLessThanOrEqual(expectedMaxExpiration);
    });
  });

  describe('validateWalletQR', () => {
    it('debe validar un QR correctamente firmado y vigente', async () => {
      const walletId = 'wallet-123';
      const timestamp = Date.now();
      const expirationTime = timestamp + (24 * 60 * 60 * 1000);

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId,
        version: 1,
        activo: true,
        paciente: {
          id: 'test-paciente-id',
          nombre: 'Test Patient',
        },
      });

      // Crear QR data válido con firma correcta
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        timestamp,
        expirationTime,
        signature,
        version: 1,
      });

      const result = await service.validateWalletQR({
        qrData,
        userId: 'test-user-id',
      });

      expect(result.isValid).toBe(true);
      expect(result.wallet).toBeDefined();
      expect(result.paciente).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('debe rechazar un QR con firma inválida', async () => {
      const qrData = JSON.stringify({
        walletId: 'wallet-123',
        timestamp: Date.now(),
        expirationTime: Date.now() + (24 * 60 * 60 * 1000),
        signature: 'invalid-signature',
        version: 1,
      });

      await expect(
        service.validateWalletQR({ qrData, userId: 'test-user-id' })
      ).rejects.toThrow('Invalid QR: signature mismatch');
    });

    it('debe rechazar un QR expirado', async () => {
      const walletId = 'wallet-123';
      const timestamp = Date.now() - (48 * 60 * 60 * 1000); // Hace 48 horas
      const expirationTime = timestamp + (24 * 60 * 60 * 1000); // Expiró hace 24 horas

      // Crear firma válida pero con fecha expirada
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        timestamp,
        expirationTime,
        signature,
        version: 1,
      });

      await expect(
        service.validateWalletQR({ qrData, userId: 'test-user-id' })
      ).rejects.toThrow('QR expired');
    });

    it('debe rechazar un QR si el wallet no existe', async () => {
      const walletId = 'non-existent-wallet';
      const timestamp = Date.now();
      const expirationTime = timestamp + (24 * 60 * 60 * 1000);

      // Crear firma válida
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        timestamp,
        expirationTime,
        signature,
        version: 1,
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue(null);

      await expect(
        service.validateWalletQR({ qrData, userId: 'test-user-id' })
      ).rejects.toThrow('Wallet not found or inactive');
    });

    it('debe rechazar un QR si el wallet está inactivo', async () => {
      const walletId = 'wallet-123';
      const timestamp = Date.now();
      const expirationTime = timestamp + (24 * 60 * 60 * 1000);

      // Crear firma válida
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        timestamp,
        expirationTime,
        signature,
        version: 1,
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId,
        activo: false, // Inactivo
      });

      await expect(
        service.validateWalletQR({ qrData, userId: 'test-user-id' })
      ).rejects.toThrow('Wallet not found or inactive');
    });

    it('debe manejar JSON malformado', async () => {
      await expect(
        service.validateWalletQR({ qrData: 'invalid-json', userId: 'test-user-id' })
      ).rejects.toThrow();
    });
  });

  describe('generatePharmacyQR', () => {
    it('debe generar un QR temporal para validación de farmacia', async () => {
      const pacienteId = 'test-paciente-id';
      const walletId = 'wallet-123';

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId,
        walletId,
        activo: true,
      });

      const result = await service.generatePharmacyQR(pacienteId, 1); // 1 hora

      expect(result).toBe('data:image/png;base64,mock-qr-data');
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });

    it('debe generar QR con duración personalizada', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId: 'wallet-123',
        activo: true,
      });

      await service.generatePharmacyQR('test-paciente-id', 2); // 2 horas

      const qrCall = (QRCode.toDataURL as any).mock.calls[0][0];
      const qrData = JSON.parse(qrCall);

      expect(qrData.purpose).toBe('pharmacy_validation');
    });

    it('debe rechazar si el wallet no existe', async () => {
      mockPrisma.healthWallet.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePharmacyQR('non-existent-paciente')
      ).rejects.toThrow('Wallet not found or inactive');
    });
  });

  describe('validatePharmacyQR', () => {
    it('debe validar un QR de farmacia correctamente', async () => {
      const walletId = 'wallet-123';
      const timestamp = Date.now();
      const expirationTime = timestamp + (60 * 60 * 1000); // 1 hora

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-db-id',
        pacienteId: 'test-paciente-id',
        walletId,
        activo: true,
        paciente: {
          id: 'test-paciente-id',
          nombre: 'Test Patient',
        },
      });

      // Crear firma válida
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${expect.any(String)}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const tempToken = 'random-token-123';
      const properSignature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${tempToken}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        tempToken,
        timestamp,
        expirationTime,
        signature: properSignature,
        purpose: 'pharmacy_validation',
      });

      const result = await service.validatePharmacyQR(qrData, 'pharmacy-user-id');

      expect(result.isValid).toBe(true);
      expect(result.wallet).toBeDefined();
    });

    it('debe rechazar QR con propósito incorrecto', async () => {
      const qrData = JSON.stringify({
        walletId: 'wallet-123',
        tempToken: 'token',
        timestamp: Date.now(),
        expirationTime: Date.now() + (60 * 60 * 1000),
        signature: 'signature',
        purpose: 'wrong_purpose',
      });

      await expect(
        service.validatePharmacyQR(qrData)
      ).rejects.toThrow('Invalid QR purpose');
    });

    it('debe rechazar QR de farmacia expirado', async () => {
      const walletId = 'wallet-123';
      const timestamp = Date.now() - (2 * 60 * 60 * 1000); // Hace 2 horas
      const expirationTime = timestamp + (60 * 60 * 1000); // Expiró hace 1 hora

      // Crear firma válida pero con fecha expirada
      const crypto = await import('crypto');
      const tempToken = 'token-123';
      const signature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'fallback-secret-key')
        .update(`${walletId}:${tempToken}:${timestamp}:${expirationTime}`)
        .digest('hex');

      const qrData = JSON.stringify({
        walletId,
        tempToken,
        timestamp,
        expirationTime,
        signature,
        purpose: 'pharmacy_validation',
      });

      await expect(
        service.validatePharmacyQR(qrData)
      ).rejects.toThrow('QR expired');
    });
  });
});
