import { Router, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { AuthRequest } from '../../middleware/auth.js';
import { rateLimitByIP } from '../../middleware/rateLimit.js';
import prisma from '../../config/database.js';
import {
  authenticateUser,
  refreshTokens,
  logoutUser,
  logoutUserAllDevices,
  hashPassword,
  generateTokenPair
} from '../../services/auth.service.js';

const router: Router = Router();

// ============= SEC-001: RATE LIMITING =============
// Stricter rate limiting for sensitive auth endpoints
// Login: 5 requests per minute per IP (extra strict for brute force prevention)
// Register: 5 requests per minute per IP (prevents spam registration)
// Login endpoint has additional rate limiting on top of the general auth route limit
const loginRateLimit = rateLimitByIP({
  preset: 'auth',
  config: { limit: 5, windowSeconds: 60 },
  message: 'Too many login attempts. Please try again later.'
});

const registerRateLimit = rateLimitByIP({
  preset: 'auth',
  config: { limit: 5, windowSeconds: 60 },
  message: 'Too many registration attempts. Please try again later.'
});

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Login Request Body Interface
 */
interface LoginRequestBody {
  email: string;
  password: string;
}

/**
 * Refresh Token Request Body Interface
 */
interface RefreshTokenRequestBody {
  refreshToken: string;
}

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// ============================================================================

/**
 * Validador de email con formato estricto
 * - Formato válido de email
 * - Máximo 255 caracteres
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
 * Validador de password con requisitos de seguridad
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula
 * - Al menos 1 número
 * - Al menos 1 carácter especial (!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?)
 */
const passwordSchema = z
  .string({
    required_error: 'Password es requerida',
    invalid_type_error: 'Password debe ser un texto'
  })
  .min(8, 'Password debe tener mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Password debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Password debe contener al menos un número')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{};\':"|,.<>/?)'
  )
  .max(128, 'Password debe tener máximo 128 caracteres');

/**
 * Validador de nombre
 * - Mínimo 2 caracteres
 * - Máximo 100 caracteres
 * - Solo letras, espacios, acentos y caracteres comunes en nombres
 */
const nombreSchema = z
  .string({
    required_error: 'Nombre es requerido',
    invalid_type_error: 'Nombre debe ser un texto'
  })
  .min(2, 'Nombre debe tener mínimo 2 caracteres')
  .max(100, 'Nombre debe tener máximo 100 caracteres')
  .regex(
    /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
    'Nombre contiene caracteres inválidos. Solo se permiten letras, espacios, acentos y guiones'
  )
  .trim();

/**
 * Esquema de validación para registro
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombre: nombreSchema
});

/**
 * Esquema de validación para login
 */
const loginSchema = z.object({
  email: z.string().min(1, 'Email es requerido').email('Formato de email inválido'),
  password: z.string().min(1, 'Password es requerida')
});

/**
 * Esquema de validación para refresh token
 */
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token es requerido')
});

// ============================================================================
// ENDPOINTS DE AUTENTICACIÓN
// ============================================================================

/**
 * POST /api/auth/register
 *
 * Registro de nuevos usuarios (DOCTOR)
 *
 * SEC-001: Rate limiting: 5 requests per minute per IP
 *
 * Request body:
 * {
 *   "email": "doctor@example.com",
 *   "password": "Password123!",
 *   "nombre": "Dr. Juan Pérez"
 * }
 *
 * Response:
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "doctor@example.com",
 *     "rol": "DOCTOR",
 *     "nombre": "Dr. Juan Pérez"
 *   },
 *   "tokens": {
 *     "accessToken": "jwt-access-token",
 *     "refreshToken": "jwt-refresh-token"
 *   }
 * }
 *
 * Errores:
 * - 400: Validación fallida (detalles en response)
 * - 409: Email ya registrado
 * - 429: Rate limit exceeded
 */
router.post('/register', registerRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    // Validar datos de entrada con Zod
    const validationResult = registerSchema.safeParse(req.body);

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

    const { email, password, nombre } = validationResult.data;

    // Verificar si el email ya existe
    const existingCuenta = await prisma.cuenta.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingCuenta) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'El email ya está registrado'
      });
    }

    // Hash password con bcrypt (salt rounds: 10 - desde auth.service.ts es 12)
    const passwordHash = await hashPassword(password);

    // Crear cuenta con rol por defecto: DOCTOR
    const nuevaCuenta = await prisma.cuenta.create({
      data: {
        email,
        passwordHash,
        nombre,
        rol: 'DOCTOR'
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true
      }
    });

    // Generar tokens
    const tokens = generateTokenPair({
      sub: nuevaCuenta.id,
      email: nuevaCuenta.email,
      rol: nuevaCuenta.rol as 'DOCTOR' | 'ADMIN'
    });

    // Store refresh token en base de datos
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: nuevaCuenta.id,
        userType: 'CUENTA',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      }
    });

    // Log de registro exitoso
    logger.info({ userId: nuevaCuenta.id, email: nuevaCuenta.email, rol: nuevaCuenta.rol }, 'User registered successfully');

    // Retornar tokens y usuario
    return res.status(201).json({
      user: {
        id: nuevaCuenta.id,
        email: nuevaCuenta.email,
        nombre: nuevaCuenta.nombre,
        rol: nuevaCuenta.rol
      },
      tokens
    });
  } catch (error) {
    logger.error({ error }, 'Error in register');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al registrar usuario'
    });
  }
});

/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 * Returns both access and refresh tokens
 *
 * SEC-001: Rate limiting: 5 requests per minute per IP
 * Extra strict to prevent brute force attacks
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Response:
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "rol": "DOCTOR",
 *     "nombre": "Dr. Juan Perez",
 *     "cuentaId": "uuid" // solo para usuarios vinculados
 *   },
 *   "tokens": {
 *     "accessToken": "jwt-access-token",
 *     "refreshToken": "jwt-refresh-token"
 *   }
 * }
 */
router.post('/login', loginRateLimit, async (req: AuthRequest, res: Response) => {
  // Validate request with Zod
  const validationResult = loginSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid request data',
      details: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }

  const { email, password } = validationResult.data;

  try {
    // Authenticate user
    const result = await authenticateUser(email, password);

    if (!result) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Log successful login
    logger.info({ userId: result.user.id, email: result.user.email, rol: result.user.rol }, 'User logged in');

    // Return user info and tokens
    res.json({
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    logger.error({ error, email }, 'Login error');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/refresh
 *
 * Refresh an access token using a valid refresh token
 * Implements token rotation for security
 *
 * Request body:
 * {
 *   "refreshToken": "jwt-refresh-token"
 * }
 *
 * Response:
 * {
 *   "accessToken": "new-jwt-access-token",
 *   "refreshToken": "new-jwt-refresh-token"
 * }
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  // Validate request with Zod
  const validationResult = refreshTokenSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid request data',
      details: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }

  const { refreshToken } = validationResult.data;

  try {
    // Refresh tokens (rotates the refresh token)
    const tokens = await refreshTokens(refreshToken);

    logger.debug({ refreshToken: refreshToken.substring(0, 20) + '...' }, 'Token refreshed');

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    logger.warn({ error: message }, 'Failed to refresh token');

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * POST /api/auth/logout
 *
 * Logout user by revoking their refresh token
 *
 * Request body:
 * {
 *   "refreshToken": "jwt-refresh-token"
 * }
 *
 * Response:
 * {
 *   "message": "Logged out successfully"
 * }
 */
router.post('/logout', async (req: AuthRequest, res: Response) => {
  // Validate request with Zod
  const validationResult = refreshTokenSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid request data',
      details: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }

  const { refreshToken } = validationResult.data;

  try {
    const revoked = await logoutUser(refreshToken);

    if (revoked) {
      logger.info({ refreshToken: refreshToken.substring(0, 20) + '...' }, 'User logged out');
      return res.json({
        message: 'Logged out successfully'
      });
    }

    // Token not found or already revoked
    return res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error({ error }, 'Logout error');
    // Don't fail on logout - always return success
    res.json({
      message: 'Logged out successfully'
    });
  }
});

/**
 * POST /api/auth/logout-all
 *
 * Logout user from all devices by revoking all their refresh tokens
 * Requires authentication
 *
 * Response:
 * {
 *   "message": "Logged out from all devices",
 *   "revokedCount": 5
 * }
 */
router.post('/logout-all', async (req: AuthRequest, res: Response) => {
  // This endpoint requires authentication (user must be logged in)
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  try {
    // Determine user type based on role
    const isLinkedUser = req.user.rol === 'ASISTENTE' || req.user.rol === 'ENFERMERA';

    // Revoke all tokens for this user
    const revokedCount = await logoutUserAllDevices(
      req.user.id,
      isLinkedUser ? 'USUARIO_VINCULADO' : 'CUENTA'
    );

    logger.info({ userId: req.user.id, revokedCount }, 'User logged out from all devices');

    res.json({
      message: 'Logged out from all devices',
      revokedCount
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Logout all error');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to logout from all devices'
    });
  }
});

/**
 * GET /api/auth/me
 *
 * Get current authenticated user info
 * Requires authentication
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  res.json({
    user: req.user
  });
});

export default router;
