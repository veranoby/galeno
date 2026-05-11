/**
 * Wallet Backup Service Tests
 *
 * Tests unitarios y de integración para el servicio de backup encriptado
 * Implementa TASK-GAP-003: Health Wallet Backup
 *
 * Coverage objetivo: 80%+
 * - Unit tests para encripción/desencripción
 * - Integration tests para backup/restore
 * - Edge cases: password incorrecto, datos corruptos, backup expirado
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import WalletBackupService from '../backup.service';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// MOCKS
// ============================================================================

// Mock PrismaClient
const mockPrisma = {
  paciente: {
    findUnique: vi.fn()
  },
  consulta: {
    findMany: vi.fn()
  },
  documento: {
    findMany: vi.fn()
  },
  conexionPaciente: {
    findFirst: vi.fn()
  }
} as unknown as PrismaClient;

// Mock AuditService
vi.mock('../../audit/audit.service', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_PACIENTE = {
  id: 'test-paciente-123',
  nombre: 'Juan Pérez',
  cedula: '1234567890',
  fechaNacimiento: new Date('1990-01-15'),
  healthWallet: {
    id: 'hw-123',
    walletId: 'HW-TEST123',
    activo: true,
    version: 1
  }
};

const TEST_CONSULTAS = [
  {
    id: 'consulta-1',
    createdAt: new Date('2024-01-15'),
    motivoConsulta: 'Consulta general',
    diagnosticoCie10: { codigo: 'J00', descripcion: 'Nasofaringitis aguda' },
    doctor: {
      nombre: 'Dr. Smith',
      especialidad: 'Medicina General'
    }
  }
];

const TEST_DOCUMENTOS = [
  {
    id: 'doc-1',
    tipo: 'RECETA',
    fechaEmision: new Date('2024-01-15'),
    archivoNombre: 'receta_001.pdf'
  }
];

const TEST_PASSWORD = 'SecurePassword123!';
const TEST_INVALID_PASSWORD = 'WrongPassword456!';

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('WalletBackupService - Unit Tests', () => {
  let service: WalletBackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletBackupService(mockPrisma);
  });

  describe('encryptBackup / decryptBackup', () => {
    const testData = {
      paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
      consultas: [],
      documentos: [],
      healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
    };

    it('encripta y desencripta datos correctamente', async () => {
      // Encriptar
      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);

      // Validar estructura del backup encriptado
      expect(encrypted.version).toBe(1);
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.kdf).toBe('PBKDF2-SHA256');
      expect(encrypted.iterations).toBe(100000);
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.createdAt).toBeDefined();
      expect(encrypted.expiresAt).toBeDefined();

      // Desencriptar
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);

      // Validar datos desencriptados
      expect(decrypted.paciente.id).toBe(testData.paciente.id);
      expect(decrypted.paciente.nombre).toBe(testData.paciente.nombre);
      expect(decrypted.healthWallet.walletId).toBe(testData.healthWallet.walletId);
    });

    it('falla al desencriptar con password incorrecto', async () => {
      // Encriptar con password correcto
      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);

      // Intentar desencriptar con password incorrecto
      await expect(service.decryptBackup(encrypted, TEST_INVALID_PASSWORD))
        .rejects
        .toThrow('Invalid password or corrupted backup data');
    });

    it('genera diferentes salts para cada encripción', async () => {
      const encrypted1 = await service.encryptBackup(testData, TEST_PASSWORD);
      const encrypted2 = await service.encryptBackup(testData, TEST_PASSWORD);

      // Los salts deben ser diferentes (aleatorios)
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('maneja datos complejos con caracteres especiales', async () => {
      const complexData = {
        paciente: {
          id: '1',
          nombre: 'María José García-Pérez',
          cedula: '1234567890',
          fechaNacimiento: '2000-01-01'
        },
        consultas: [
          {
            id: '1',
            fecha: '2024-01-15',
            motivoConsulta: 'Dolor de cabeza (cefalea)',
            diagnosticoCie10: { codigo: 'G43.9', descripcion: 'Migraña sin aura' },
            doctorNombre: 'Dr. Smith',
            doctorEspecialidad: 'Neurología'
          }
        ],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(complexData, TEST_PASSWORD);
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);

      expect(decrypted.paciente.nombre).toBe('María José García-Pérez');
      expect(decrypted.consultas[0].motivoConsulta).toBe('Dolor de cabeza (cefalea)');
      expect(decrypted.consultas[0].diagnosticoCie10.codigo).toBe('G43.9');
    });

    it('maneja objetos vacíos', async () => {
      const emptyData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(emptyData, TEST_PASSWORD);
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);

      expect(decrypted.consultas).toEqual([]);
      expect(decrypted.documentos).toEqual([]);
    });
  });

  describe('validateBackupPassword', () => {
    it('retorna true con password correcto', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      const isValid = await service.validateBackupPassword(encrypted, TEST_PASSWORD);

      expect(isValid).toBe(true);
    });

    it('retorna false con password incorrecto', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      const isValid = await service.validateBackupPassword(encrypted, TEST_INVALID_PASSWORD);

      expect(isValid).toBe(false);
    });
  });

  describe('getBackupMetadata', () => {
    it('obtiene metadata sin desencriptar', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      const metadata = service.getBackupMetadata(encrypted);

      expect(metadata.version).toBe(1);
      expect(metadata.algorithm).toBe('AES-256-GCM');
      expect(metadata.kdf).toBe('PBKDF2-SHA256');
      expect(metadata.iterations).toBe(100000);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.isExpired).toBe(false);
    });

    it('detecta backup expirado', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      // Forzar fecha de expiración en el pasado
      encrypted.expiresAt = new Date(Date.now() - 1000).toISOString();

      const metadata = service.getBackupMetadata(encrypted);

      expect(metadata.isExpired).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('WalletBackupService - Integration Tests', () => {
  let service: WalletBackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletBackupService(mockPrisma);
  });

  describe('createBackup', () => {
    beforeEach(() => {
      // Setup mocks para createBackup
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue(TEST_CONSULTAS);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue(TEST_DOCUMENTOS);
    });

    it('crea backup encriptado exitosamente', async () => {
      const result = await service.createBackup(
        TEST_PACIENTE.id,
        TEST_PASSWORD,
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.version).toBe(1);
      expect(result.data?.algorithm).toBe('AES-256-GCM');
      expect(result.message).toBe('Backup created successfully');
    });

    it('falla cuando el paciente no existe', async () => {
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(null);

      const result = await service.createBackup(
        'non-existent-paciente',
        TEST_PASSWORD,
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Paciente no encontrado');
    });

    it('falla cuando el Health Wallet no está activo', async () => {
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue({
        ...TEST_PACIENTE,
        healthWallet: { ...TEST_PACIENTE.healthWallet, activo: false }
      });

      const result = await service.createBackup(
        TEST_PACIENTE.id,
        TEST_PASSWORD,
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Health Wallet no encontrado o inactivo');
    });
  });

  describe('restoreBackup', () => {
    it('restaura backup encriptado exitosamente', async () => {
      // Primero crear un backup
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue(TEST_CONSULTAS);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue(TEST_DOCUMENTOS);

      const createResult = await service.createBackup(
        TEST_PACIENTE.id,
        TEST_PASSWORD,
        'user-123'
      );

      // Luego restaurar
      const restoreResult = await service.restoreBackup(
        createResult.data!,
        TEST_PASSWORD,
        'user-123'
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data).toBeDefined();
      expect(restoreResult.data?.paciente.id).toBe(TEST_PACIENTE.id);
      expect(restoreResult.data?.paciente.nombre).toBe(TEST_PACIENTE.nombre);
      expect(restoreResult.data?.consultas.length).toBe(TEST_CONSULTAS.length);
      expect(restoreResult.message).toBe('Backup restored successfully');
    });

    it('falla al restaurar con backup expirado', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      encrypted.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expirado

      const result = await service.restoreBackup(encrypted, TEST_PASSWORD, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('falla al restaurar con password incorrecto', async () => {
      // Primero crear un backup
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue(TEST_CONSULTAS);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue(TEST_DOCUMENTOS);

      const createResult = await service.createBackup(
        TEST_PACIENTE.id,
        TEST_PASSWORD,
        'user-123'
      );

      // Intentar restaurar con password incorrecto
      const restoreResult = await service.restoreBackup(
        createResult.data!,
        TEST_INVALID_PASSWORD,
        'user-123'
      );

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.error).toContain('Invalid password or corrupted backup data');
    });
  });

  describe('getBasicHistory', () => {
    it('obtiene historial básico del paciente', async () => {
      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue(TEST_CONSULTAS);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue(TEST_DOCUMENTOS);

      const history = await service.getBasicHistory(TEST_PACIENTE.id);

      expect(history.paciente.id).toBe(TEST_PACIENTE.id);
      expect(history.paciente.nombre).toBe(TEST_PACIENTE.nombre);
      expect(history.consultas.length).toBe(TEST_CONSULTAS.length);
      expect(history.documentos.length).toBe(TEST_DOCUMENTOS.length);
      expect(history.healthWallet.walletId).toBe(TEST_PACIENTE.healthWallet.walletId);
    });

    it('limita consultas a 100', async () => {
      const manyConsultas = Array(150).fill(null).map((_, i) => ({
        id: `consulta-${i}`,
        createdAt: new Date(),
        motivoConsulta: 'Consulta',
        diagnosticoCie10: {},
        doctor: { nombre: 'Dr. Test', especialidad: 'General' }
      }));

      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue(manyConsultas);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue([]);

      const history = await service.getBasicHistory(TEST_PACIENTE.id);

      expect(history.consultas.length).toBeLessThanOrEqual(100);
    });

    it('limita documentos a 100', async () => {
      const manyDocumentos = Array(150).fill(null).map((_, i) => ({
        id: `doc-${i}`,
        tipo: 'RECETA',
        fechaEmision: new Date(),
        archivoNombre: `doc_${i}.pdf`
      }));

      mockPrisma.paciente.findUnique = vi.fn().mockResolvedValue(TEST_PACIENTE);
      mockPrisma.consulta.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.documento.findMany = vi.fn().mockResolvedValue(manyDocumentos);

      const history = await service.getBasicHistory(TEST_PACIENTE.id);

      expect(history.documentos.length).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================================================
// EDGE CASES & SECURITY TESTS
// ============================================================================

describe('WalletBackupService - Security & Edge Cases', () => {
  let service: WalletBackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletBackupService(mockPrisma);
  });

  describe('Password Security', () => {
    it('maneja passwords con caracteres especiales', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const specialPassword = 'P@$$w0rd!#$%^&*()_+-=[]{}|;:,.<>?';

      const encrypted = await service.encryptBackup(testData, specialPassword);
      const decrypted = await service.decryptBackup(encrypted, specialPassword);

      expect(decrypted.paciente.id).toBe(testData.paciente.id);
    });

    it('maneja passwords muy largos', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const longPassword = 'a'.repeat(1000);

      const encrypted = await service.encryptBackup(testData, longPassword);
      const decrypted = await service.decryptBackup(encrypted, longPassword);

      expect(decrypted.paciente.id).toBe(testData.paciente.id);
    });

    it('maneja passwords con emojis', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const emojiPassword = 'Password123!🔐🔑';

      const encrypted = await service.encryptBackup(testData, emojiPassword);
      const decrypted = await service.decryptBackup(encrypted, emojiPassword);

      expect(decrypted.paciente.id).toBe(testData.paciente.id);
    });
  });

  describe('Data Integrity', () => {
    it('detecta datos corruptos', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);

      // Corromper ciphertext
      encrypted.ciphertext = 'corrupted_' + encrypted.ciphertext;

      await expect(service.decryptBackup(encrypted, TEST_PASSWORD))
        .rejects
        .toThrow();
    });

    it('detecta auth tag inválido', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);

      // Corromper auth tag
      encrypted.authTag = 'invalid_tag';

      await expect(service.decryptBackup(encrypted, TEST_PASSWORD))
        .rejects
        .toThrow();
    });
  });

  describe('Empty & Null Handling', () => {
    it('maneja strings vacíos en datos', async () => {
      const testData = {
        paciente: { id: '1', nombre: '', cedula: '', fechaNacimiento: '2000-01-01' },
        consultas: [],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData, TEST_PASSWORD);
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);

      expect(decrypted.paciente.nombre).toBe('');
      expect(decrypted.paciente.cedula).toBe('');
    });

    it('maneja null values en datos', async () => {
      const testData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: [{
          id: '1',
          fecha: '2024-01-15',
          motivoConsulta: null,
          diagnosticoCie10: null,
          doctorNombre: 'Dr. Test',
          doctorEspecialidad: null
        }],
        documentos: [],
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(testData as any, TEST_PASSWORD);
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);

      expect(decrypted.consultas[0].motivoConsulta).toBeNull();
    });
  });

  describe('Performance', () => {
    it('encripta datos grandes en tiempo razonable', async () => {
      const largeData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: Array(100).fill(null).map((_, i) => ({
          id: `consulta-${i}`,
          fecha: '2024-01-15',
          motivoConsulta: 'Consulta de prueba',
          diagnosticoCie10: { codigo: 'J00', descripcion: 'Nasofaringitis' },
          doctorNombre: 'Dr. Test',
          doctorEspecialidad: 'General'
        })),
        documentos: Array(100).fill(null).map((_, i) => ({
          id: `doc-${i}`,
          tipo: 'RECETA',
          fechaEmision: '2024-01-15',
          nombre: `documento_${i}.pdf`
        })),
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const startTime = Date.now();
      const encrypted = await service.encryptBackup(largeData, TEST_PASSWORD);
      const endTime = Date.now();

      // La encripción debería tomar menos de 5 segundos
      expect(endTime - startTime).toBeLessThan(5000);
      expect(encrypted).toBeDefined();
    });

    it('desencripta datos grandes en tiempo razonable', async () => {
      const largeData = {
        paciente: { id: '1', nombre: 'Test', cedula: '123', fechaNacimiento: '2000-01-01' },
        consultas: Array(100).fill(null).map((_, i) => ({
          id: `consulta-${i}`,
          fecha: '2024-01-15',
          motivoConsulta: 'Consulta de prueba',
          diagnosticoCie10: { codigo: 'J00', descripcion: 'Nasofaringitis' },
          doctorNombre: 'Dr. Test',
          doctorEspecialidad: 'General'
        })),
        documentos: Array(100).fill(null).map((_, i) => ({
          id: `doc-${i}`,
          tipo: 'RECETA',
          fechaEmision: '2024-01-15',
          nombre: `documento_${i}.pdf`
        })),
        healthWallet: { walletId: 'HW-TEST', activo: true, version: 1 }
      };

      const encrypted = await service.encryptBackup(largeData, TEST_PASSWORD);

      const startTime = Date.now();
      const decrypted = await service.decryptBackup(encrypted, TEST_PASSWORD);
      const endTime = Date.now();

      // La desencripción debería tomar menos de 5 segundos
      expect(endTime - startTime).toBeLessThan(5000);
      expect(decrypted.consultas.length).toBe(100);
    });
  });
});
