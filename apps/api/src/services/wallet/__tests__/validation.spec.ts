/**
 * Tests unitarios para WalletValidationService
 * TASK-039: Validación Health Wallet
 *
 * Flujo TDD: Tests escritos antes de la implementación
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import WalletValidationService from '../validation.js';
import { AuditService } from '../../audit/audit.service';

// Mock de Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock del AuditService
vi.mock('../../audit/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock de jwt para generar tokens - usando factory para evitar problemas de inicialización
vi.mock('jsonwebtoken', async () => {
  const actual = await vi.importActual('jsonwebtoken');
  return {
    ...actual,
    sign: vi.fn(() => 'mock-jwt-token'),
    verify: vi.fn((token: string, secret: string) => {
      if (token === 'expired-token') {
        const error: any = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      }
      if (token === 'invalid-token') {
        const error: any = new Error('invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      }
      return {
        citaId: 'test-cita-id',
        doctorId: 'test-doctor-id',
        pacienteId: 'test-paciente-id',
        tipo: 'temporal_wallet_access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
    }),
    default: {
      sign: vi.fn(() => 'mock-jwt-token'),
      verify: vi.fn((token: string, secret: string) => {
        if (token === 'expired-token') {
          const error: any = new Error('jwt expired');
          error.name = 'TokenExpiredError';
          throw error;
        }
        if (token === 'invalid-token') {
          const error: any = new Error('invalid token');
          error.name = 'JsonWebTokenError';
          throw error;
        }
        return {
          citaId: 'test-cita-id',
          doctorId: 'test-doctor-id',
          pacienteId: 'test-paciente-id',
          tipo: 'temporal_wallet_access',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      }),
    },
  };
});

describe('WalletValidationService', () => {
  let service: WalletValidationService;
  let mockPrisma: any;

  beforeEach(() => {
    // Setup mock de Prisma
    mockPrisma = {
      cita: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      healthWallet: {
        findUnique: vi.fn(),
      },
      conexionPaciente: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      consulta: {
        findMany: vi.fn(),
      },
      documento: {
        findMany: vi.fn(),
      },
      paciente: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    // Mock PrismaClient constructor
    (PrismaClient as unknown as any).mockImplementation(() => mockPrisma);

    service = new WalletValidationService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTemporalToken', () => {
    it('debe generar un token JWT con expiración correcta', async () => {
      const citaId = 'test-cita-id';
      const doctorId = 'test-doctor-id';
      const pacienteId = 'test-paciente-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'programada',
        tipo: 'teleconsulta',
        doctorId,
        pacienteId,
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-id',
        pacienteId,
        activo: true,
      });

      // Mock para el caso cuando ya existe una conexión (se actualizará)
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'existing-conexion-id',
        pacienteId,
        doctorId,
        estado: 'activa',
      });

      mockPrisma.conexionPaciente.update.mockResolvedValue({
        id: 'existing-conexion-id',
        pacienteId,
        doctorId,
        estado: 'activa',
      });

      const result = await service.generateTemporalToken({
        citaId,
        doctorId,
        pacienteId,
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(AuditService.log).toHaveBeenCalledWith(
        doctorId,
        'TEMPORAL_ACCESS_GRANTED',
        'HEALTH_WALLET',
        expect.any(String),
        expect.any(String),
        undefined,
        expect.objectContaining({
          citaId,
          pacienteId,
        })
      );
    });

    it('debe rechazar si la cita no existe', async () => {
      mockPrisma.cita.findUnique.mockResolvedValue(null);

      await expect(
        service.generateTemporalToken({
          citaId: 'non-existent-cita',
          doctorId: 'test-doctor-id',
          pacienteId: 'test-paciente-id',
        })
      ).rejects.toThrow('Cita no encontrada');
    });

    it('debe rechazar si la cita no es una teleconsulta', async () => {
      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'programada',
        tipo: 'presencial', // No es teleconsulta
        doctorId: 'test-doctor-id',
        pacienteId: 'test-paciente-id',
      });

      await expect(
        service.generateTemporalToken({
          citaId: 'test-cita-id',
          doctorId: 'test-doctor-id',
          pacienteId: 'test-paciente-id',
        })
      ).rejects.toThrow('La cita debe ser una teleconsulta');
    });

    it('debe rechazar si el paciente no tiene Health Wallet activo', async () => {
      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'programada',
        tipo: 'teleconsulta',
        doctorId: 'test-doctor-id',
        pacienteId: 'test-paciente-id',
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue(null);

      await expect(
        service.generateTemporalToken({
          citaId: 'test-cita-id',
          doctorId: 'test-doctor-id',
          pacienteId: 'test-paciente-id',
        })
      ).rejects.toThrow('Health Wallet no encontrado o inactivo');
    });

    it('debe crear conexión temporal si no existe', async () => {
      const citaId = 'test-cita-id';
      const doctorId = 'test-doctor-id';
      const pacienteId = 'test-paciente-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'programada',
        tipo: 'teleconsulta',
        doctorId,
        pacienteId,
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-id',
        pacienteId,
        activo: true,
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue(null);
      mockPrisma.conexionPaciente.create.mockResolvedValue({
        id: 'conexion-id',
        pacienteId,
        doctorId,
        estado: 'activa',
      });

      await service.generateTemporalToken({
        citaId,
        doctorId,
        pacienteId,
      });

      // Verificar que se creó la conexión temporal
      expect(mockPrisma.conexionPaciente.create).toHaveBeenCalled();
    });
  });

  describe('validateTemporalAccess', () => {
    it('debe validar un token activo correctamente', async () => {
      const token = 'valid-token';
      const citaId = 'test-cita-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'en_progreso',
        tipo: 'teleconsulta',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
      });

      const result = await service.validateTemporalAccess(token);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.citaId).toBe(citaId);
    });

    it('debe rechazar un token expirado', async () => {
      const token = 'expired-token';

      const result = await service.validateTemporalAccess(token);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expirado');
    });

    it('debe rechazar un token inválido', async () => {
      const token = 'invalid-token';

      const result = await service.validateTemporalAccess(token);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token inválido');
    });

    it('debe rechazar si la cita ya terminó', async () => {
      const token = 'valid-token';
      const citaId = 'test-cita-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'completada', // Ya terminó
        tipo: 'teleconsulta',
      });

      const result = await service.validateTemporalAccess(token);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La consulta ya finalizó');
    });

    it('debe rechazar si la conexión temporal fue revocada', async () => {
      const token = 'valid-token';
      const citaId = 'test-cita-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'en_progreso',
        tipo: 'teleconsulta',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'revocada', // Conexión revocada
      });

      const result = await service.validateTemporalAccess(token);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Acceso revocado');
    });

    it('debe registrar auditoría LOPDP al validar acceso', async () => {
      const token = 'valid-token';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'en_progreso',
        tipo: 'teleconsulta',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
      });

      await service.validateTemporalAccess(token);

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.any(String),
        'TEMPORAL_ACCESS_VALIDATED',
        'HEALTH_WALLET',
        expect.any(String),
        expect.any(String),
        undefined,
        expect.any(Object)
      );
    });
  });

  describe('revokeAccessAfterConsultation', () => {
    it('debe revocar el acceso temporal después de la consulta', async () => {
      const citaId = 'test-cita-id';
      const doctorId = 'test-doctor-id';
      const pacienteId = 'test-paciente-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        doctorId,
        pacienteId,
        estado: 'completada',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
      });

      mockPrisma.conexionPaciente.update.mockResolvedValue({
        id: 'conexion-id',
        estado: 'revocada',
        revocadaEn: new Date(),
      });

      await service.revokeAccessAfterConsultation(citaId);

      expect(mockPrisma.conexionPaciente.update).toHaveBeenCalledWith({
        where: { id: 'conexion-id' },
        data: {
          estado: 'revocada',
          revocadaEn: expect.any(Date),
        },
      });

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.any(String),
        'TEMPORAL_ACCESS_REVOKED',
        'HEALTH_WALLET',
        expect.any(String),
        expect.any(String),
        undefined,
        expect.objectContaining({
          citaId,
          reason: 'consulta_finalizada',
        })
      );
    });

    it('debe registrar auditoría LOPDP al revocar', async () => {
      const citaId = 'test-cita-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        doctorId: 'test-doctor-id',
        pacienteId: 'test-paciente-id',
        estado: 'completada',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
      });

      mockPrisma.conexionPaciente.update.mockResolvedValue({
        id: 'conexion-id',
        estado: 'revocada',
      });

      await service.revokeAccessAfterConsultation(citaId);

      expect(AuditService.log).toHaveBeenCalled();
    });

    it('no debe hacer nada si no hay conexión temporal', async () => {
      const citaId = 'test-cita-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        doctorId: 'test-doctor-id',
        pacienteId: 'test-paciente-id',
        estado: 'completada',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue(null);

      await service.revokeAccessAfterConsultation(citaId);

      expect(mockPrisma.conexionPaciente.update).not.toHaveBeenCalled();
    });
  });

  describe('getPatientHistoryForConsultation', () => {
    it('debe retornar el historial médico con un token válido', async () => {
      const token = 'valid-token';
      const pacienteId = 'test-paciente-id';

      const mockConsultas = [
        {
          id: 'consulta-1',
          fecha: new Date('2024-01-01'),
          motivo: 'Consulta general',
          diagnostico: 'Gripe estacional',
        },
        {
          id: 'consulta-2',
          fecha: new Date('2024-02-01'),
          motivo: 'Control',
          diagnostico: 'Sin novedades',
        },
      ];

      const mockDocumentos = [
        {
          id: 'doc-1',
          tipo: 'RECETA',
          fechaEmision: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          tipo: 'EXAMEN',
          fechaEmision: new Date('2024-01-02'),
        },
      ];

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'en_progreso',
        tipo: 'teleconsulta',
        pacienteId,
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
        permisos: {
          temporal: true,
          verHistorial: true,
          verDocumentos: true,
        },
      });

      mockPrisma.consulta.findMany.mockResolvedValue(mockConsultas);
      mockPrisma.documento.findMany.mockResolvedValue(mockDocumentos);
      mockPrisma.paciente.findUnique.mockResolvedValue({
        id: pacienteId,
        nombre: 'Test Patient',
      });

      const result = await service.getPatientHistoryForConsultation(token);

      expect(result).toBeDefined();
      expect(result.consultas).toHaveLength(2);
      expect(result.documentos).toHaveLength(2);
      // Verificar que auditLog fue llamado (LOPDP compliance)
      expect(AuditService.log).toHaveBeenCalled();
    });

    it('debe rechazar acceso si el token no tiene permiso de ver historial', async () => {
      const token = 'valid-token';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'en_progreso',
        tipo: 'teleconsulta',
        pacienteId: 'test-paciente-id',
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
        permisos: {
          temporal: true,
          verHistorial: false, // Sin permiso
          verDocumentos: false,
        },
      });

      await expect(
        service.getPatientHistoryForConsultation(token)
      ).rejects.toThrow('Sin permisos para ver el historial');
    });

    it('debe filtrar consultas según permisos LIMITADOS', async () => {
      const token = 'valid-token';
      const pacienteId = 'test-paciente-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'en_progreso',
        tipo: 'teleconsulta',
        pacienteId,
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
        tipoAcceso: 'LIMITADO',
        permisos: {
          temporal: true,
          verHistorial: true,
          verDocumentos: true,
          consultaIds: ['consulta-1'], // Solo esta consulta
        },
      });

      mockPrisma.consulta.findMany.mockResolvedValue([
        {
          id: 'consulta-1',
          fecha: new Date(),
        },
      ]);

      mockPrisma.documento.findMany.mockResolvedValue([]);
      mockPrisma.paciente.findUnique.mockResolvedValue({
        id: pacienteId,
        nombre: 'Test Patient',
      });

      const result = await service.getPatientHistoryForConsultation(token);

      expect(mockPrisma.consulta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['consulta-1'] },
          }),
        })
      );
    });

    it('debe registrar auditoría LOPDP al acceder al historial', async () => {
      const token = 'valid-token';
      const pacienteId = 'test-paciente-id';

      mockPrisma.cita.findUnique.mockResolvedValue({
        id: 'test-cita-id',
        estado: 'en_progreso',
        tipo: 'teleconsulta',
        pacienteId,
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
        permisos: {
          temporal: true,
          verHistorial: true,
          verDocumentos: true,
        },
      });

      mockPrisma.consulta.findMany.mockResolvedValue([]);
      mockPrisma.documento.findMany.mockResolvedValue([]);
      mockPrisma.paciente.findUnique.mockResolvedValue({
        id: pacienteId,
        nombre: 'Test Patient',
      });

      await service.getPatientHistoryForConsultation(token);

      // Verificar que auditLog fue llamado (LOPDP compliance)
      expect(AuditService.log).toHaveBeenCalled();
    });
  });

  describe('LOPDP Compliance', () => {
    it('debe registrar audit log en todas las operaciones', async () => {
      const citaId = 'test-cita-id';
      const doctorId = 'test-doctor-id';
      const pacienteId = 'test-paciente-id';

      // Setup mocks
      mockPrisma.cita.findUnique.mockResolvedValue({
        id: citaId,
        estado: 'programada',
        tipo: 'teleconsulta',
        doctorId,
        pacienteId,
      });

      mockPrisma.healthWallet.findUnique.mockResolvedValue({
        id: 'wallet-id',
        pacienteId,
        activo: true,
      });

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'conexion-id',
        estado: 'activa',
        permisos: {
          temporal: true,
          verHistorial: true,
          verDocumentos: true,
        },
      });

      mockPrisma.conexionPaciente.create.mockResolvedValue({
        id: 'conexion-id',
      });

      mockPrisma.conexionPaciente.update.mockResolvedValue({
        id: 'conexion-id',
        estado: 'revocada',
      });

      mockPrisma.consulta.findMany.mockResolvedValue([]);
      mockPrisma.documento.findMany.mockResolvedValue([]);
      mockPrisma.paciente.findUnique.mockResolvedValue({
        id: pacienteId,
        nombre: 'Test Patient',
      });

      // Ejecutar todas las operaciones
      await service.generateTemporalToken({ citaId, doctorId, pacienteId });
      expect(AuditService.log).toHaveBeenCalled();

      vi.clearAllMocks();

      await service.validateTemporalAccess('valid-token');
      expect(AuditService.log).toHaveBeenCalled();

      vi.clearAllMocks();

      await service.revokeAccessAfterConsultation(citaId);
      expect(AuditService.log).toHaveBeenCalled();

      vi.clearAllMocks();

      await service.getPatientHistoryForConsultation('valid-token');
      expect(AuditService.log).toHaveBeenCalled();
    });
  });
});
