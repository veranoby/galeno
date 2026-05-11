/**
 * ShareTokenService Tests
 *
 * Pruebas unitarias para el servicio de ShareToken LOPDP
 * TASK-045: Protocolo Compartir LOPDP
 *
 * @module tests/services/lopdp/share-token.service.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ShareTokenService from '../share-token.service.js';
import { AuditService } from '../../audit/audit.service.js';
import jwt from 'jsonwebtoken';

// Mock de Prisma
const mockPrisma = {
  paciente: {
    findUnique: vi.fn(),
    findFirst: vi.fn()
  },
  cuenta: {
    findUnique: vi.fn()
  },
  healthWallet: {
    findUnique: vi.fn()
  },
  conexionPaciente: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  consulta: {
    findMany: vi.fn()
  },
  documento: {
    findMany: vi.fn()
  },
  antecedentePaciente: {
    findMany: vi.fn()
  },
  $executeRaw: vi.fn()
};

// Mock de AuditService
vi.mock('../../../src/services/audit/audit.service.js', () => ({
  AuditService: {
    log: vi.fn()
  }
}));

// Mock de logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock de QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock-qr-data'))
  }
}));

describe('ShareTokenService', () => {
  let service: ShareTokenService;

  // Datos mock para pruebas
  const mockPaciente = {
    id: 'PAC-123',
    cuentaId: 'USER-123',
    cuenta: {
      nombre: 'Juan Pérez'
    }
  };

  const mockDoctor = {
    id: 'DOC-456',
    nombre: 'Dr. María García',
    especialidad: 'Cardiología',
    rol: 'DOCTOR'
  };

  const mockHealthWallet = {
    id: 'HW-789',
    pacienteId: 'PAC-123',
    walletId: 'HW-ABC123',
    activo: true
  };

  const mockPermisos = {
    verConsultas: true,
    verDocumentos: true,
    verAntecedentes: false,
    verRecetas: false,
    verExamenes: true,
    descargarDocumentos: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShareTokenService(mockPrisma as any);

    // Setup de mocks básicos
    mockPrisma.paciente.findUnique.mockResolvedValue(mockPaciente);
    mockPrisma.cuenta.findUnique.mockResolvedValue(mockDoctor);
    mockPrisma.healthWallet.findUnique.mockResolvedValue(mockHealthWallet);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateShareToken', () => {
    it('debe generar un ShareToken exitosamente con TTL predeterminado (15 min)', async () => {
      // Arrange
      mockPrisma.conexionPaciente.create.mockResolvedValue({
        id: 'CON-123',
        pacienteId: 'PAC-123',
        doctorId: 'DOC-456',
        estado: 'activa'
      });

      const input = {
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-456',
        permisos: mockPermisos,
        motivoComparticion: 'Segunda opinión médica'
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.sharedSessionId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.qrData).toBeDefined();

      // Verificar que el token es válido JWT
      const decoded = jwt.decode(result.token!) as any;
      expect(decoded).toBeDefined();
      expect(decoded.tipo).toBe('share_token');
      expect(decoded.scope).toBe('HISTORY_READ');
      expect(decoded.pacienteId).toBe('PAC-123');
      expect(decoded.doctorSolicitanteId).toBe('DOC-456');

      // Verificar expiración (15 minutos = 900 segundos)
      const timeDiff = decoded.exp - decoded.iat;
      expect(timeDiff).toBe(900);

      // Verificar que se registró en la base de datos
      expect(mockPrisma.conexionPaciente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pacienteId: 'PAC-123',
          doctorId: 'DOC-456',
          estado: 'activa',
          tipoAcceso: 'LIMITADO'
        })
      });

      // Verificar auditoría
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESOURCE_ACCESS',
          resourceType: 'PACIENTE',
          resourceId: 'PAC-123',
          metadata: expect.objectContaining({
            accion: 'GENERAR_SHARE_TOKEN',
            lopdpArticulo: 'Art. 14 - Consentimiento explícito'
          })
        })
      );
    });

    it('debe generar un ShareToken con TTL personalizado', async () => {
      // Arrange
      mockPrisma.conexionPaciente.create.mockResolvedValue({
        id: 'CON-123'
      });

      const input = {
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-456',
        permisos: mockPermisos,
        motivoComparticion: 'Consulta de emergencia',
        ttlSeconds: 1800 // 30 minutos
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(true);

      const decoded = jwt.decode(result.token!) as any;
      const timeDiff = decoded.exp - decoded.iat;
      expect(timeDiff).toBe(1800);
    });

    it('debe fallar si el paciente no existe', async () => {
      // Arrange
      mockPrisma.paciente.findUnique.mockResolvedValue(null);

      const input = {
        pacienteId: 'PAC-INVALIDO',
        doctorSolicitanteId: 'DOC-456',
        permisos: mockPermisos,
        motivoComparticion: 'Test'
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Paciente no encontrado');
    });

    it('debe fallar si el doctor no existe', async () => {
      // Arrange
      mockPrisma.cuenta.findUnique.mockResolvedValue(null);

      const input = {
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-INVALIDO',
        permisos: mockPermisos,
        motivoComparticion: 'Test'
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Doctor solicitante no encontrado o no es válido');
    });

    it('debe fallar si el Health Wallet no existe o está inactivo', async () => {
      // Arrange
      mockPrisma.healthWallet.findUnique.mockResolvedValue(null);

      const input = {
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-456',
        permisos: mockPermisos,
        motivoComparticion: 'Test'
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Health Wallet no encontrado o inactivo');
    });

    it('debe generar permisos granulares correctamente', async () => {
      // Arrange
      mockPrisma.conexionPaciente.create.mockResolvedValue({ id: 'CON-123' });

      const permisosLimitados = {
        verConsultas: true,
        verDocumentos: false,
        verAntecedentes: false,
        verRecetas: false,
        verExamenes: false,
        descargarDocumentos: false,
        consultaIds: ['CONS-1', 'CONS-2']
      };

      const input = {
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-456',
        permisos: permisosLimitados,
        motivoComparticion: 'Segunda opinión específica'
      };

      // Act
      const result = await service.generateShareToken(input);

      // Assert
      expect(result.success).toBe(true);

      const decoded = jwt.decode(result.token!) as any;
      expect(decoded.permisos.verConsultas).toBe(true);
      expect(decoded.permisos.verDocumentos).toBe(false);
      expect(decoded.permisos.consultaIds).toEqual(['CONS-1', 'CONS-2']);
    });
  });

  describe('validateShareToken', () => {
    it('debe validar un token válido exitosamente', async () => {
      // Arrange
      const validPayload = {
        sub: 'PAC-123',
        pacienteId: 'PAC-123',
        pacienteNombre: 'Juan Pérez',
        doctorSolicitanteId: 'DOC-456',
        doctorSolicitanteNombre: 'Dr. María García',
        scope: 'HISTORY_READ',
        permisos: mockPermisos,
        sharedSessionId: 'SHARED-ABC123',
        tipo: 'share_token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      };

      const token = jwt.sign(validPayload, process.env.JWT_SECRET || 'fallback-secret');

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        estado: 'activa',
        fechaExpiracion: new Date(Date.now() + 900000)
      });

      // Act
      const result = await service.validateShareToken(token);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.pacienteId).toBe('PAC-123');
      expect(result.payload?.scope).toBe('HISTORY_READ');
    });

    it('debe rechazar un token expirado', async () => {
      // Arrange
      const expiredPayload = {
        ...mockPaciente,
        tipo: 'share_token',
        scope: 'HISTORY_READ',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) - 100 // Expirado hace 100 segundos
      };

      const token = jwt.sign(expiredPayload, process.env.JWT_SECRET || 'fallback-secret');

      // Act
      const result = await service.validateShareToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expirado');
    });

    it('debe rechazar un token con tipo inválido', async () => {
      // Arrange
      const invalidPayload = {
        tipo: 'invalid_type',
        scope: 'HISTORY_READ'
      };

      const token = jwt.sign(invalidPayload as any, process.env.JWT_SECRET || 'fallback-secret');

      // Act
      const result = await service.validateShareToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Tipo de token inválido');
    });

    it('debe rechazar un token con scope inválido', async () => {
      // Arrange
      const invalidPayload = {
        tipo: 'share_token',
        scope: 'INVALID_SCOPE'
      };

      const token = jwt.sign(invalidPayload as any, process.env.JWT_SECRET || 'fallback-secret');

      // Act
      const result = await service.validateShareToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Scope de token inválido');
    });

    it('debe rechazar un token de sesión revocada', async () => {
      // Arrange
      const validPayload = {
        sub: 'PAC-123',
        pacienteId: 'PAC-123',
        tipo: 'share_token',
        scope: 'HISTORY_READ',
        sharedSessionId: 'SHARED-ABC123',
        exp: Math.floor(Date.now() / 1000) + 900
      };

      const token = jwt.sign(validPayload, process.env.JWT_SECRET || 'fallback-secret');

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        estado: 'revocada'
      });

      // Act
      const result = await service.validateShareToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Acceso revocado por el paciente');
    });
  });

  describe('exchangeToken', () => {
    it('debe intercambiar un token válido por SharedSessionID', async () => {
      // Arrange
      const validPayload = {
        sub: 'PAC-123',
        pacienteId: 'PAC-123',
        pacienteNombre: 'Juan Pérez',
        doctorSolicitanteId: 'DOC-456',
        doctorSolicitanteNombre: 'Dr. María García',
        scope: 'HISTORY_READ',
        permisos: mockPermisos,
        sharedSessionId: 'SHARED-ABC123',
        tipo: 'share_token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      };

      const token = jwt.sign(validPayload, process.env.JWT_SECRET || 'fallback-secret');

      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        estado: 'activa'
      });

      const input = {
        shareToken: token,
        doctorId: 'DOC-456'
      };

      // Act
      const result = await service.exchangeToken(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sharedSessionId).toBe('SHARED-ABC123');
      expect(result.pacienteInfo).toEqual({
        id: 'PAC-123',
        nombre: 'Juan Pérez'
      });
      expect(result.permisos).toEqual(mockPermisos);

      // Verificar auditoría
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESOURCE_ACCESS',
          metadata: expect.objectContaining({
            accion: 'INTERCAMBIAR_SHARE_TOKEN',
            lopdpArticulo: 'Art. 15 - Acceso granular'
          })
        })
      );
    });

    it('debe fallar si el doctor no coincide con el token', async () => {
      // Arrange
      const validPayload = {
        sub: 'PAC-123',
        pacienteId: 'PAC-123',
        doctorSolicitanteId: 'DOC-456',
        tipo: 'share_token',
        scope: 'HISTORY_READ',
        exp: Math.floor(Date.now() / 1000) + 900
      };

      const token = jwt.sign(validPayload, process.env.JWT_SECRET || 'fallback-secret');

      const input = {
        shareToken: token,
        doctorId: 'DOC-INVALIDO' // Doctor diferente
      };

      // Act
      const result = await service.exchangeToken(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Doctor no autorizado para este token');
    });
  });

  describe('revokeSharedSession', () => {
    it('debe revocar una sesión compartida exitosamente', async () => {
      // Arrange
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        pacienteId: 'PAC-123',
        doctorId: 'DOC-456',
        estado: 'activa',
        permisos: { sharedSessionId: 'SHARED-ABC123' }
      });

      mockPrisma.conexionPaciente.update.mockResolvedValue({
        id: 'CON-123',
        estado: 'revocada',
        revocadaEn: new Date()
      });

      // Act
      const result = await service.revokeSharedSession('SHARED-ABC123', 'PAC-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Acceso revocado exitosamente');

      // Verificar que se actualizó el estado
      expect(mockPrisma.conexionPaciente.update).toHaveBeenCalledWith({
        where: { id: 'CON-123' },
        data: {
          estado: 'revocada',
          revocadaEn: expect.any(Date)
        }
      });

      // Verificar auditoría (LOPDP Art. 16)
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESOURCE_ACCESS',
          metadata: expect.objectContaining({
            accion: 'REVOCAR_SHARE_TOKEN',
            lopdpArticulo: 'Art. 16 - Derecho de revocación inmediata'
          })
        })
      );
    });

    it('debe fallar si la sesión no existe', async () => {
      // Arrange
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.revokeSharedSession('SHARED-INVALIDO', 'PAC-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Sesión compartida no encontrada');
    });
  });

  describe('getFilteredHistory', () => {
    it('debe obtener historial filtrado con permisos completos', async () => {
      // Arrange
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        pacienteId: 'PAC-123',
        doctorId: 'DOC-456',
        estado: 'activa',
        permisos: {
          sharedSessionId: 'SHARED-ABC123',
          verConsultas: true,
          verDocumentos: true,
          verAntecedentes: true
        }
      });

      mockPrisma.consulta.findMany.mockResolvedValue([
        { id: 'CONS-1', motivoConsulta: 'Consulta general' }
      ]);

      mockPrisma.documento.findMany.mockResolvedValue([
        { id: 'DOC-1', tipo: 'receta' }
      ]);

      mockPrisma.antecedentePaciente.findMany.mockResolvedValue([
        { id: 'ANT-1', tipo: 'personal' }
      ]);

      // Act
      const result = await service.getFilteredHistory('SHARED-ABC123', 'DOC-456');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.consultas).toHaveLength(1);
      expect(result.data?.documentos).toHaveLength(1);
      expect(result.data?.antecedentes).toHaveLength(1);
      expect(result.data?.paciente).toBeDefined();

      // Verificar auditoría SHARED_READ
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SHARED_READ',
          metadata: expect.objectContaining({
            accion: 'LECTURA_HISTORIAL_COMPARTIDO',
            lopdpArticulo: 'Art. 15 - Auditoría de acceso'
          })
        })
      );
    });

    it('debe filtrar consultas por consultaIds específicos', async () => {
      // Arrange
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        pacienteId: 'PAC-123',
        doctorId: 'DOC-456',
        estado: 'activa',
        permisos: {
          sharedSessionId: 'SHARED-ABC123',
          verConsultas: true,
          verDocumentos: false,
          verAntecedentes: false,
          consultaIds: ['CONS-1', 'CONS-2']
        }
      });

      // Act
      await service.getFilteredHistory('SHARED-ABC123', 'DOC-456');

      // Assert
      expect(mockPrisma.consulta.findMany).toHaveBeenCalledWith({
        where: {
          pacienteId: 'PAC-123',
          id: { in: ['CONS-1', 'CONS-2'] }
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50
      });
    });

    it('debe fallar si la sesión está expirada', async () => {
      // Arrange
      mockPrisma.conexionPaciente.findFirst.mockResolvedValue({
        id: 'CON-123',
        pacienteId: 'PAC-123',
        doctorId: 'DOC-456',
        estado: 'activa',
        fechaExpiracion: new Date(Date.now() - 1000), // Expirada hace 1 segundo
        permisos: { sharedSessionId: 'SHARED-ABC123' }
      });

      // Act
      const result = await service.getFilteredHistory('SHARED-ABC123', 'DOC-456');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sesión compartida inválida o expirada');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('debe limpiar sesiones expiradas', async () => {
      // Arrange
      mockPrisma.conexionPaciente.updateMany.mockResolvedValue({
        count: 5
      });

      // Act
      const count = await service.cleanupExpiredSessions();

      // Assert
      expect(count).toBe(5);
      expect(mockPrisma.conexionPaciente.updateMany).toHaveBeenCalledWith({
        where: {
          estado: 'activa',
          fechaExpiracion: {
            lt: expect.any(Date)
          },
          permisos: {
            path: ['tipo'],
            equals: 'SHARE_TOKEN'
          }
        },
        data: {
          estado: 'revocada',
          revocadaEn: expect.any(Date)
        }
      });
    });
  });
});
