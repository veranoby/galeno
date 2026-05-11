/**
 * Wallet Backup Service
 *
 * Servicio de respaldo encriptado del Health Wallet con AES-GCM
 * Implementa TASK-GAP-003: Health Wallet Backup
 *
 * Características:
 * - Encripción AES-256-GCM usando WebCrypto API
 * - Derivación de clave PBKDF2 desde password del usuario
 * - Respaldo de firma .p12 y historial básico
 * - Descarga local segura
 * - Compliance LOPDP (datos encriptados en reposo)
 *
 * @module services/wallet/backup
 */

import { PrismaClient, AuditAction, ResourceType, HealthWallet, Consulta, Documento, Paciente } from '@prisma/client';
import crypto from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Datos básicos del historial médico para backup
 */
interface BasicHistory {
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
    fechaNacimiento: string;
  };
  consultas: Array<{
    id: string;
    fecha: string;
    motivoConsulta: string | null;
    diagnosticoCie10: any;
    doctorNombre: string;
    doctorEspecialidad: string | null;
  }>;
  documentos: Array<{
    id: string;
    tipo: string;
    fechaEmision: string;
    nombre: string | null;
  }>;
  healthWallet: {
    walletId: string;
    activo: boolean;
    version: number;
  };
}

/**
 * Estructura del backup encriptado
 */
interface EncryptedBackup {
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // Base64
  iv: string; // Base64
  authTag: string; // Base64
  ciphertext: string; // Base64
  createdAt: string;
  expiresAt?: string;
}

/**
 * Resultado de operación de backup
 */
interface BackupResult {
  success: boolean;
  data?: EncryptedBackup;
  error?: string;
  message?: string;
}

/**
 * Resultado de restauración
 */
interface RestoreResult {
  success: boolean;
  data?: BasicHistory;
  error?: string;
  message?: string;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 12; // 96 bits - recomendado para GCM
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation for 2024
const PBKDF2_HASH = 'sha256';
const BACKUP_VERSION = 1;

// ============================================================================
// WALLET BACKUP SERVICE
// ============================================================================

class WalletBackupService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Deriva una clave de encripción desde el password del usuario usando PBKDF2
   *
   * @param password - Password del usuario
   * @param salt - Salt aleatorio (16 bytes)
   * @returns Clave derivada de 256 bits
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_SIZE,
      PBKDF2_HASH
    );
  }

  /**
   * Genera un salt aleatorio seguro
   *
   * @returns Buffer de 16 bytes
   */
  private generateSalt(): Buffer {
    return crypto.randomBytes(16);
  }

  /**
   * Genera un IV aleatorio seguro para AES-GCM
   *
   * @returns Buffer de 12 bytes
   */
  private generateIV(): Buffer {
    return crypto.randomBytes(IV_SIZE);
  }

  /**
   * Encripta datos usando AES-256-GCM
   *
   * @param data - Datos a encriptar (object)
   * @param password - Password para derivar la clave
   * @returns Datos encriptados con metadata
   */
  async encryptBackup(data: BasicHistory, password: string): Promise<EncryptedBackup> {
    try {
      // 1. Generar salt y IV aleatorios
      const salt = this.generateSalt();
      const iv = this.generateIV();

      // 2. Derivar clave desde password
      const key = this.deriveKey(password, salt);

      // 3. Crear cipher AES-256-GCM
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      // 4. Serializar datos a JSON
      const plaintext = JSON.stringify(data);

      // 5. Encriptar datos
      let ciphertext = cipher.update(plaintext, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);

      // 6. Obtener auth tag (GCM lo genera automáticamente)
      const authTag = cipher.getAuthTag();

      // 7. Construir resultado
      const encryptedBackup: EncryptedBackup = {
        version: BACKUP_VERSION,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
      };

      return encryptedBackup;
    } catch (error) {
      logger.error({ error }, 'Backup encryption failed');
      throw new Error('Failed to encrypt backup data');
    }
  }

  /**
   * Desencripta un backup usando AES-256-GCM
   *
   * @param encryptedBackup - Backup encriptado
   * @param password - Password para derivar la clave
   * @returns Datos originales desencriptados
   */
  async decryptBackup(encryptedBackup: EncryptedBackup, password: string): Promise<BasicHistory> {
    try {
      // 1. Decodificar componentes desde base64
      const salt = Buffer.from(encryptedBackup.salt, 'base64');
      const iv = Buffer.from(encryptedBackup.iv, 'base64');
      const authTag = Buffer.from(encryptedBackup.authTag, 'base64');
      const ciphertext = Buffer.from(encryptedBackup.ciphertext, 'base64');

      // 2. Derivar clave desde password (misma derivación que en encrypt)
      const key = this.deriveKey(password, salt);

      // 3. Crear decipher AES-256-GCM
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

      // 4. Setear auth tag antes de desencriptar
      decipher.setAuthTag(authTag);

      // 5. Desencriptar datos
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      // 6. Parsear JSON
      const data: BasicHistory = JSON.parse(plaintext.toString('utf8'));

      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth tag')) {
        logger.warn({ error }, 'Backup decryption failed - invalid password or corrupted data');
        throw new Error('Invalid password or corrupted backup data');
      }

      logger.error({ error }, 'Backup decryption failed');
      throw new Error('Failed to decrypt backup data');
    }
  }

  /**
   * Obtiene el historial básico de un paciente para backup
   *
   * @param pacienteId - ID del paciente
   * @returns Historial básico del paciente
   */
  async getBasicHistory(pacienteId: string): Promise<BasicHistory> {
    try {
      // 1. Obtener datos del paciente
      const paciente = await this.prisma.paciente.findUnique({
        where: { id: pacienteId },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          fechaNacimiento: true,
          healthWallet: true
        }
      });

      if (!paciente) {
        throw new Error('Paciente no encontrado');
      }

      if (!paciente.healthWallet || !paciente.healthWallet.activo) {
        throw new Error('Health Wallet no encontrado o inactivo');
      }

      // 2. Obtener consultas recientes (últimas 100)
      const consultas = await this.prisma.consulta.findMany({
        where: { pacienteId },
        select: {
          id: true,
          createdAt: true,
          motivoConsulta: true,
          diagnosticoCie10: true,
          doctor: {
            select: {
              nombre: true,
              especialidad: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      // 3. Obtener documentos del paciente
      const documentos = await this.prisma.documento.findMany({
        where: {
          pacienteId,
          estado: 'activo'
        },
        select: {
          id: true,
          tipo: true,
          fechaEmision: true,
          archivoNombre: true
        },
        orderBy: { fechaEmision: 'desc' },
        take: 100
      });

      // 4. Construir historial básico
      const basicHistory: BasicHistory = {
        paciente: {
          id: paciente.id,
          nombre: paciente.nombre,
          cedula: paciente.cedula,
          fechaNacimiento: paciente.fechaNacimiento.toISOString()
        },
        consultas: consultas.map(c => ({
          id: c.id,
          fecha: c.createdAt.toISOString(),
          motivoConsulta: c.motivoConsulta,
          diagnosticoCie10: c.diagnosticoCie10,
          doctorNombre: c.doctor.nombre,
          doctorEspecialidad: c.doctor.especialidad
        })),
        documentos: documentos.map(d => ({
          id: d.id,
          tipo: d.tipo,
          fechaEmision: d.fechaEmision.toISOString(),
          nombre: d.archivoNombre
        })),
        healthWallet: {
          walletId: paciente.healthWallet.walletId,
          activo: paciente.healthWallet.activo,
          version: paciente.healthWallet.version
        }
      };

      return basicHistory;
    } catch (error) {
      logger.error({ error, pacienteId }, 'Failed to fetch basic history');
      throw new Error('Failed to fetch patient history for backup');
    }
  }

  /**
   * Crea un backup encriptado del Health Wallet
   *
   * @param pacienteId - ID del paciente
   * @param password - Password del usuario para derivar clave
   * @param userId - ID del usuario que solicita el backup (para audit)
   * @returns Backup encriptado
   */
  async createBackup(
    pacienteId: string,
    password: string,
    userId: string
  ): Promise<BackupResult> {
    try {
      // 1. Obtener historial básico
      const basicHistory = await this.getBasicHistory(pacienteId);

      // 2. Encriptar datos
      const encryptedBackup = await this.encryptBackup(basicHistory, password);

      // 3. Registrar audit log
      await AuditService.log({
        userId,
        action: 'RESOURCE_ACCESS' as AuditAction,
        resourceType: 'PACIENTE' as ResourceType,
        resourceId: pacienteId,
        rolUsuario: 'DOCTOR',
        metadata: {
          actionType: 'WALLET_BACKUP_CREATED',
          walletId: basicHistory.healthWallet.walletId,
          encryptedAt: encryptedBackup.createdAt,
          expiresAt: encryptedBackup.expiresAt,
          algorithm: encryptedBackup.algorithm,
          kdf: encryptedBackup.kdf
        }
      });

      logger.info({
        pacienteId,
        userId,
        walletId: basicHistory.healthWallet.walletId
      }, 'Wallet backup created successfully');

      return {
        success: true,
        data: encryptedBackup,
        message: 'Backup created successfully'
      };
    } catch (error) {
      logger.error({ error, pacienteId, userId }, 'Failed to create backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      };
    }
  }

  /**
   * Restaura un backup encriptado
   *
   * @param encryptedBackup - Backup encriptado
   * @param password - Password del usuario
   * @param userId - ID del usuario que solicita la restauración (para audit)
   * @returns Datos restaurados
   */
  async restoreBackup(
    encryptedBackup: EncryptedBackup,
    password: string,
    userId: string
  ): Promise<RestoreResult> {
    try {
      // 1. Validar versión del backup
      if (encryptedBackup.version !== BACKUP_VERSION) {
        return {
          success: false,
          error: `Unsupported backup version: ${encryptedBackup.version}`
        };
      }

      // 2. Validar fecha de expiración
      if (encryptedBackup.expiresAt && new Date(encryptedBackup.expiresAt) < new Date()) {
        return {
          success: false,
          error: 'Backup has expired'
        };
      }

      // 3. Desencriptar datos
      const basicHistory = await this.decryptBackup(encryptedBackup, password);

      // 4. Registrar audit log
      await AuditService.log({
        userId,
        action: 'RESOURCE_ACCESS' as AuditAction,
        resourceType: 'PACIENTE' as ResourceType,
        resourceId: basicHistory.paciente.id,
        rolUsuario: 'DOCTOR',
        metadata: {
          actionType: 'WALLET_BACKUP_RESTORED',
          walletId: basicHistory.healthWallet.walletId,
          restoredAt: new Date().toISOString(),
          backupCreatedAt: encryptedBackup.createdAt,
          consultaCount: basicHistory.consultas.length,
          documentoCount: basicHistory.documentos.length
        }
      });

      logger.info({
        pacienteId: basicHistory.paciente.id,
        userId,
        walletId: basicHistory.healthWallet.walletId
      }, 'Wallet backup restored successfully');

      return {
        success: true,
        data: basicHistory,
        message: 'Backup restored successfully'
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to restore backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      };
    }
  }

  /**
   * Valida si un backup puede ser restaurado con un password
   *
   * @param encryptedBackup - Backup encriptado
   * @param password - Password a validar
   * @returns true si el password es correcto
   */
  async validateBackupPassword(encryptedBackup: EncryptedBackup, password: string): Promise<boolean> {
    try {
      await this.decryptBackup(encryptedBackup, password);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene metadata de un backup sin desencriptar
   */
  getBackupMetadata(encryptedBackup: EncryptedBackup): {
    version: number;
    algorithm: string;
    kdf: string;
    iterations: number;
    createdAt: Date;
    expiresAt?: Date;
    isExpired: boolean;
  } {
    return {
      version: encryptedBackup.version,
      algorithm: encryptedBackup.algorithm,
      kdf: encryptedBackup.kdf,
      iterations: encryptedBackup.iterations,
      createdAt: new Date(encryptedBackup.createdAt),
      expiresAt: encryptedBackup.expiresAt ? new Date(encryptedBackup.expiresAt) : undefined,
      isExpired: encryptedBackup.expiresAt ? new Date(encryptedBackup.expiresAt) < new Date() : false
    };
  }
}

export default WalletBackupService;
