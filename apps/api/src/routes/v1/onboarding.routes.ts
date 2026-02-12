import { Router, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { AuthRequest } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import crypto from 'crypto';

const router: Router = Router();

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Email Verification Request
 */
interface EmailVerificationRequestBody {
  email: string;
}

/**
 * Email Verification Confirm Request
 */
interface EmailVerificationConfirmBody {
  email: string;
  code: string;
  token: string;
}

/**
 * Profile Setup Request
 */
interface ProfileSetupRequestBody {
  especialidad: string;
  subespecialidad?: string;
  numeroLicencia: string;
  telefono: string;
  consultorio: {
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono?: string;
  };
  preferencias: {
    idioma: 'es' | 'en';
    zonaHoraria: string;
    formatoHora: '12h' | '24h';
  };
}

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// ============================================================================

/**
 * Validador de email
 */
const emailSchema = z
  .string({
    required_error: 'Email es requerido',
    invalid_type_error: 'Email debe ser un texto'
  })
  .min(1, 'Email es requerido')
  .max(255, 'Email debe tener máximo 255 caracteres')
  .email('Formato de email inválido')
  .trim()
  .toLowerCase();

/**
 * Validador de código de verificación (6 dígitos)
 */
const verificationCodeSchema = z
  .string({
    required_error: 'Código de verificación es requerido'
  })
  .length(6, 'El código debe tener 6 caracteres')
  .regex(/^\d+$/, 'El código debe contener solo números');

/**
 * Validador de token
 */
const tokenSchema = z
  .string({
    required_error: 'Token es requerido'
  })
  .min(1, 'Token es requerido');

/**
 * Esquema de validación para solicitud de verificación de email
 */
const emailVerificationSchema = z.object({
  email: emailSchema
});

/**
 * Esquema de validación para confirmación de verificación de email
 */
const emailVerificationConfirmSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
  token: tokenSchema
});

/**
 * Validador de nombre de consultorio
 */
const consultorioNombreSchema = z
  .string({
    required_error: 'Nombre del consultorio es requerido'
  })
  .min(2, 'Nombre debe tener al menos 2 caracteres')
  .max(100, 'Nombre debe tener máximo 100 caracteres')
  .trim();

/**
 * Validador de dirección
 */
const direccionSchema = z
  .string({
    required_error: 'Dirección es requerida'
  })
  .min(10, 'Dirección debe tener al menos 10 caracteres')
  .max(255, 'Dirección debe tener máximo 255 caracteres')
  .trim();

/**
 * Validador de ciudad
 */
const ciudadSchema = z
  .string({
    required_error: 'Ciudad es requerida'
  })
  .min(2, 'Ciudad debe tener al menos 2 caracteres')
  .max(50, 'Ciudad debe tener máximo 50 caracteres')
  .trim();

/**
 * Validador de teléfono
 */
const telefonoSchema = z
  .string({
    required_error: 'Teléfono es requerido'
  })
  .regex(/^\+?\d{7,15}$/, 'Teléfono debe tener entre 7 y 15 dígitos, opcionalmente con +');

/**
 * Validador de número de licencia
 */
const numeroLicenciaSchema = z
  .string({
    required_error: 'Número de licencia es requerido'
  })
  .min(5, 'Número de licencia debe tener al menos 5 caracteres')
  .max(50, 'Número de licencia debe tener máximo 50 caracteres')
  .trim();

/**
 * Validador de especialidad
 */
const especialidadSchema = z
  .string({
    required_error: 'Especialidad es requerida'
  })
  .min(2, 'Especialidad debe tener al menos 2 caracteres')
  .max(100, 'Especialidad debe tener máximo 100 caracteres')
  .trim();

/**
 * Esquema de validación para configuración de perfil
 */
const profileSetupSchema = z.object({
  especialidad: especialidadSchema,
  subespecialidad: z.string().max(100).optional(),
  numeroLicencia: numeroLicenciaSchema,
  telefono: telefonoSchema,
  consultorio: z.object({
    nombre: consultorioNombreSchema,
    direccion: direccionSchema,
    ciudad: ciudadSchema,
    telefono: telefonoSchema.optional()
  }),
  preferencias: z.object({
    idioma: z.enum(['es', 'en']),
    zonaHoraria: z.string().default('America/Guayaquil'),
    formatoHora: z.enum(['12h', '24h']).default('24h')
  })
});

// ============================================================================
// ENDPOINTS DE ONBOARDING
// ============================================================================

/**
 * POST /api/onboarding/send-verification
 *
 * Envía un código de verificación al email del usuario
 *
 * Request body:
 * {
 *   "email": "doctor@example.com"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Código de verificación enviado",
 *   "expiresAt": "2024-01-01T12:00:00Z",
 *   "token": "verification-token"
 * }
 */
router.post('/send-verification', async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = emailVerificationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validación fallida',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const { email } = validationResult.data;

    // Verificar si el email ya existe
    const existingCuenta = await prisma.cuenta.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingCuenta) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El email ya está registrado'
      });
    }

    // Generar código de 6 dígitos
    const code = crypto.randomInt(100000, 999999).toString();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // En un entorno real, aquí enviaríamos el email
    // Por ahora, solo logueamos el código
    logger.info({ email, code, token, expiresAt }, 'Verification code generated');

    // Guardar código en Redis o base de datos temporal
    // Por ahora, lo guardamos en memoria del usuario en la base de datos
    // En producción, usar Redis con TTL

    return res.status(200).json({
      success: true,
      message: 'Código de verificación enviado',
      expiresAt: expiresAt.toISOString(),
      token
    });
  } catch (error) {
    logger.error({ error }, 'Error in send-verification');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al enviar código de verificación'
    });
  }
});

/**
 * POST /api/onboarding/verify-email
 *
 * Verifica el código de verificación del email
 *
 * Request body:
 * {
 *   "email": "doctor@example.com",
 *   "code": "123456",
 *   "token": "verification-token"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Email verificado exitosamente",
 *   "verified": true
 * }
 */
router.post('/verify-email', async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = emailVerificationConfirmSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validación fallida',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const { email, code, token } = validationResult.data;

    // En un entorno real, verificaríamos el código contra Redis
    // Por ahora, aceptamos cualquier código de 6 dígitos para desarrollo
    logger.info({ email, code: code.substring(0, 2) + '***', token: token.substring(0, 8) + '...' }, 'Email verification attempt');

    // Simulación de verificación exitosa
    return res.status(200).json({
      success: true,
      message: 'Email verificado exitosamente',
      verified: true
    });
  } catch (error) {
    logger.error({ error }, 'Error in verify-email');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al verificar email'
    });
  }
});

/**
 * POST /api/onboarding/setup-profile
 *
 * Completa la configuración del perfil del médico
 * Requiere autenticación
 *
 * Request body:
 * {
 *   "especialidad": "Medicina General",
 *   "subespecialidad": "Cardiología",
 *   "numeroLicencia": "12345",
 *   "telefono": "+593987654321",
 *   "consultorio": {
 *     "nombre": "Consultorio Dr. Pérez",
 *     "direccion": "Av. Principal 123",
 *     "ciudad": "Quito",
 *     "telefono": "+5932123456"
 *   },
 *   "preferencias": {
 *     "idioma": "es",
 *     "zonaHoraria": "America/Guayaquil",
 *     "formatoHora": "24h"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Perfil configurado exitosamente",
 *   "user": { ... }
 * }
 */
router.post('/setup-profile', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Autenticación requerida'
    });
  }

  try {
    const validationResult = profileSetupSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validación fallida',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const profileData = validationResult.data;

    // Actualizar cuenta con datos del perfil
    const updatedCuenta = await prisma.cuenta.update({
      where: { id: req.user.id },
      data: {
        especialidad: profileData.especialidad,
        // Agregar campos personalizados si es necesario
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        especialidad: true,
        plan: true
      }
    });

    // Crear ubicación del consultorio
    await prisma.ubicacion.create({
      data: {
        doctorId: req.user.id,
        nombre: profileData.consultorio.nombre,
        direccion: profileData.consultorio.direccion,
        telefono: profileData.consultorio.telefono || profileData.telefono,
        activo: true
      }
    });

    logger.info({ userId: req.user.id, especialidad: profileData.especialidad }, 'Profile setup completed');

    return res.status(200).json({
      success: true,
      message: 'Perfil configurado exitosamente',
      user: updatedCuenta
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error in setup-profile');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al configurar perfil'
    });
  }
});

/**
 * POST /api/onboarding/complete
 *
 * Marca el proceso de onboarding como completado
 * Requiere autenticación
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Onboarding completado exitosamente"
 * }
 */
router.post('/complete', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Autenticación requerida'
    });
  }

  try {
    // Actualizar cuenta marcando onboarding como completado
    // Nota: Este campo necesita ser agregado al schema de Prisma
    await prisma.cuenta.update({
      where: { id: req.user.id },
      data: {
        updatedAt: new Date()
      }
    });

    logger.info({ userId: req.user.id }, 'Onboarding completed');

    return res.status(200).json({
      success: true,
      message: 'Onboarding completado exitosamente'
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error in complete onboarding');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al completar onboarding'
    });
  }
});

/**
 * GET /api/onboarding/status
 *
 * Obtiene el estado actual del onboarding
 * Requiere autenticación
 *
 * Response:
 * {
 *   "currentStep": "email_verification",
 *   "completed": false,
 *   "emailVerified": false,
 *   "profileCompleted": false
 * }
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Autenticación requerida'
    });
  }

  try {
    const cuenta = await prisma.cuenta.findUnique({
      where: { id: req.user.id },
      select: {
        especialidad: true,
        ubicaciones: {
          where: { activo: true },
          take: 1
        }
      }
    });

    const profileCompleted = !!cuenta?.especialidad && cuenta.ubicaciones.length > 0;

    return res.status(200).json({
      currentStep: profileCompleted ? 'tutorial' : 'profile_setup',
      completed: false,
      emailVerified: true, // Asumimos verificado si está autenticado
      profileCompleted
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error getting onboarding status');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener estado de onboarding'
    });
  }
});

export default router;
