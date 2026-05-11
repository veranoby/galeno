/**
 * Wallet Backup Routes
 *
 * Rutas para respaldo y restauración encriptada del Health Wallet
 * Implementa TASK-GAP-003: Health Wallet Backup
 *
 * Endpoints:
 * - POST /api/v1/wallet/backup/create - Crea backup encriptado
 * - POST /api/v1/wallet/backup/restore - Restaura backup encriptado
 * - POST /api/v1/wallet/backup/validate - Valida password de backup
 * - GET  /api/v1/wallet/backup/metadata - Obtiene metadata de backup
 * - POST /api/v1/wallet/backup/download - Descarga archivo de backup
 *
 * Security:
 * - AES-256-GCM encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Password nunca almacenado
 * - Audit trail completo
 *
 * @module routes/v1/wallet/backup
 */

import { Router, Response, Request } from 'express';
import { authMiddleware, AuthRequest } from '../../../middleware/auth.js';
import WalletBackupService from '../../../services/wallet/backup.service.js';
import prisma from '../../../config/database.js';

const router: Router = Router();

// Initialize service
const walletBackupService = new WalletBackupService(prisma);

/**
 * @route POST /api/v1/wallet/backup/create
 * @description Crea un backup encriptado del Health Wallet
 * @access Paciente/Doctor autorizado (requiere autenticación)
 *
 * @body {string} pacienteId - ID del paciente
 * @body {string} password - Password para derivar clave de encripción
 */
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { pacienteId, password } = req.body;

    // Validaciones básicas
    if (!pacienteId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'pacienteId es requerido'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password debe tener al menos 8 caracteres'
      });
    }

    // Verificar que el usuario tiene permiso para acceder al paciente
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });

    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Paciente no encontrado'
      });
    }

    // Verificar autorización (dueño del paciente o doctor con acceso)
    if (paciente.cuentaId !== userId) {
      // Verificar si es doctor con conexión activa
      const conexion = await prisma.conexionPaciente.findFirst({
        where: {
          pacienteId,
          doctorId: userId,
          estado: 'activa'
        }
      });

      if (!conexion) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'No autorizado para crear backup de este paciente'
        });
      }
    }

    // Crear backup
    const result = await walletBackupService.createBackup(pacienteId, password, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: result.message
    });
  } catch (error) {
    console.error('[WalletBackup] Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear backup'
    });
  }
});

/**
 * @route POST /api/v1/wallet/backup/restore
 * @description Restaura un backup encriptado
 * @access Paciente/Doctor autorizado (requiere autenticación)
 *
 * @body {object} encryptedBackup - Datos del backup encriptado
 * @body {string} password - Password para desencriptar
 */
router.post('/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { encryptedBackup, password } = req.body;

    // Validaciones básicas
    if (!encryptedBackup) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'encryptedBackup es requerido'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'password es requerido'
      });
    }

    // Validar estructura del backup
    if (
      !encryptedBackup.version ||
      !encryptedBackup.algorithm ||
      !encryptedBackup.ciphertext ||
      !encryptedBackup.salt ||
      !encryptedBackup.iv ||
      !encryptedBackup.authTag
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'encryptedBackup tiene estructura inválida'
      });
    }

    // Restaurar backup
    const result = await walletBackupService.restoreBackup(encryptedBackup, password, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: result.message
    });
  } catch (error) {
    console.error('[WalletBackup] Error restoring backup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al restaurar backup'
    });
  }
});

/**
 * @route POST /api/v1/wallet/backup/validate
 * @description Valida si un password puede desencriptar un backup
 * @access Usuario autenticado
 *
 * @body {object} encryptedBackup - Datos del backup encriptado
 * @body {string} password - Password a validar
 */
router.post('/validate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { encryptedBackup, password } = req.body;

    // Validaciones básicas
    if (!encryptedBackup || !password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'encryptedBackup y password son requeridos'
      });
    }

    // Validar password
    const isValid = await walletBackupService.validateBackupPassword(encryptedBackup, password);

    res.status(200).json({
      success: true,
      data: { isValid }
    });
  } catch (error) {
    console.error('[WalletBackup] Error validating password:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al validar password'
    });
  }
});

/**
 * @route POST /api/v1/wallet/backup/metadata
 * @description Obtiene metadata de un backup sin desencriptar
 * @access Usuario autenticado
 *
 * @body {object} encryptedBackup - Datos del backup encriptado
 */
router.post('/metadata', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { encryptedBackup } = req.body;

    if (!encryptedBackup) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'encryptedBackup es requerido'
      });
    }

    const metadata = walletBackupService.getBackupMetadata(encryptedBackup);

    res.status(200).json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('[WalletBackup] Error getting metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener metadata'
    });
  }
});

/**
 * @route POST /api/v1/wallet/backup/download
 * @description Descarga archivo de backup encriptado
 * @access Paciente/Doctor autorizado (requiere autenticación)
 *
 * @body {string} pacienteId - ID del paciente
 * @body {string} password - Password para encriptar
 *
 * @returns Archivo JSON encriptado para descarga
 */
router.post('/download', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { pacienteId, password } = req.body;

    // Validaciones básicas
    if (!pacienteId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'pacienteId es requerido'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password debe tener al menos 8 caracteres'
      });
    }

    // Verificar que el usuario tiene permiso para acceder al paciente
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true, nombre: true }
    });

    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Paciente no encontrado'
      });
    }

    // Verificar autorización
    if (paciente.cuentaId !== userId) {
      const conexion = await prisma.conexionPaciente.findFirst({
        where: {
          pacienteId,
          doctorId: userId,
          estado: 'activa'
        }
      });

      if (!conexion) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'No autorizado para descargar backup de este paciente'
        });
      }
    }

    // Crear backup encriptado
    const result = await walletBackupService.createBackup(pacienteId, password, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error
      });
    }

    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `galeno-backup-${paciente.nombre.replace(/\s+/g, '-')}-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Backup-Version', result.data!.version.toString());
    res.setHeader('X-Backup-Algorithm', result.data!.algorithm);
    res.setHeader('X-Backup-Created', result.data!.createdAt);

    // Enviar datos encriptados
    res.status(200).json(result.data);
  } catch (error) {
    console.error('[WalletBackup] Error downloading backup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al descargar backup'
    });
  }
});

/**
 * @route GET /api/v1/wallet/backup/history/:pacienteId
 * @description Obtiene historial básico para preview (sin encriptar)
 * @access Paciente/Doctor autorizado (requiere autenticación)
 *
 * @param {string} pacienteId - ID del paciente
 */
router.get('/history/:pacienteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pacienteId } = req.params as { pacienteId: string };
    const userId = req.user!.id;

    // Verificar autorización
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { cuentaId: true }
    });

    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Paciente no encontrado'
      });
    }

    if (paciente.cuentaId !== userId) {
      const conexion = await prisma.conexionPaciente.findFirst({
        where: {
          pacienteId,
          doctorId: userId,
          estado: 'activa'
        }
      });

      if (!conexion) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'No autorizado para ver historial de este paciente'
        });
      }
    }

    // Obtener historial básico
    const basicHistory = await walletBackupService.getBasicHistory(pacienteId);

    res.status(200).json({
      success: true,
      data: basicHistory
    });
  } catch (error) {
    console.error('[WalletBackup] Error getting history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener historial'
    });
  }
});

export default router;
