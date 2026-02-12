import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

// ============= TYPES =============

// Import Prisma types for proper typing
import { Rol, RolVinculado } from '@prisma/client';

// Combined role type for JWT tokens
export type RolToken = Rol | RolVinculado;

export interface JWTPayload {
  sub: string; // user_id
  email: string;
  rol: RolToken;
  cuentaId?: string; // Para usuarios vinculados
  type?: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    rol: RolToken;
    nombre: string;
    cuentaId?: string;
  };
  tokens: TokenPair;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

// ============= CONFIGURATION =============

const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutos
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 días

const getAccessTokenSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return secret;
};

const getRefreshTokenSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }
  return secret;
};

// ============= TOKEN GENERATION =============

/**
 * Generate an access token (15 minutes expiration)
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'type'>): string {
  const secret = getAccessTokenSecret();

  return jwt.sign(
    {
      ...payload,
      type: 'access'
    } as JWTPayload,
    secret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      subject: payload.sub
    }
  );
}

/**
 * Generate a refresh token (7 days expiration)
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'type'>): string {
  const secret = getRefreshTokenSecret();

  return jwt.sign(
    {
      ...payload,
      type: 'refresh'
    } as JWTPayload,
    secret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      subject: payload.sub
    }
  );
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: Omit<JWTPayload, 'type'>): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
}

// ============= TOKEN VERIFICATION =============

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  const secret = getAccessTokenSecret();

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  const secret = getRefreshTokenSecret();

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

// ============= PASSWORD HASHING =============

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============= REFRESH TOKEN MANAGEMENT =============

/**
 * Store a refresh token in the database
 */
export async function storeRefreshToken(
  token: string,
  userId: string,
  userType: 'CUENTA' | 'USUARIO_VINCULADO'
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      userType,
      expiresAt
    }
  });

  logger.debug({ userId, userType }, 'Refresh token stored');
}

/**
 * Verify a refresh token exists and is valid in the database
 */
export async function getStoredRefreshToken(token: string): Promise<{
  id: string;
  userId: string;
  userType: 'CUENTA' | 'USUARIO_VINCULADO';
  expiresAt: Date;
  revokedAt: Date | null;
} | null> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    select: {
      id: true,
      userId: true,
      userType: true,
      expiresAt: true,
      revokedAt: true
    }
  });

  if (!storedToken) {
    return null;
  }

  // Check if token is revoked
  if (storedToken.revokedAt) {
    return null;
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    return null;
  }

  return storedToken;
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { token },
    data: { revokedAt: new Date() }
  });

  return result.count > 0;
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(
  userId: string,
  userType: 'CUENTA' | 'USUARIO_VINCULADO'
): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      userType,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });

  return result.count;
}

/**
 * Rotate a refresh token (revoke old, issue new)
 */
export async function rotateRefreshToken(
  oldToken: string,
  newToken: string
): Promise<void> {
  // Get the old token's info
  const stored = await getStoredRefreshToken(oldToken);
  if (!stored) {
    throw new Error('Invalid or expired refresh token');
  }

  // Revoke the old token and set the replacement
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      revokedAt: new Date(),
      replacedBy: newToken
    }
  });

  // Store the new token
  await storeRefreshToken(newToken, stored.userId, stored.userType);
}

/**
 * Clean up expired/revoked tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } }
      ]
    }
  });

  logger.info({ count: result.count }, 'Cleaned up expired tokens');
  return result.count;
}

// ============= AUTHENTICATION =============

/**
 * Authenticate a Cuenta (doctor/admin)
 */
export async function authenticateCuenta(
  email: string,
  password: string
): Promise<LoginResult | null> {
  const cuenta = await prisma.cuenta.findUnique({
    where: { email }
  });

  if (!cuenta) {
    return null;
  }

  const isValid = await verifyPassword(password, cuenta.passwordHash);
  if (!isValid) {
    return null;
  }

  // Generate tokens
  const payload: Omit<JWTPayload, 'type'> = {
    sub: cuenta.id,
    email: cuenta.email,
    rol: cuenta.rol
  };

  const tokens = generateTokenPair(payload);

  // Store refresh token
  await storeRefreshToken(tokens.refreshToken, cuenta.id, 'CUENTA');

  return {
    user: {
      id: cuenta.id,
      email: cuenta.email,
      rol: cuenta.rol,
      nombre: cuenta.nombre
    },
    tokens
  };
}

/**
 * Authenticate a UsuarioVinculado (asistente/enfermera)
 */
export async function authenticateUsuarioVinculado(
  email: string,
  password: string
): Promise<LoginResult | null> {
  const usuario = await prisma.usuarioVinculado.findUnique({
    where: { email },
    include: {
      doctorAsignado: {
        select: {
          id: true,
          email: true,
          nombre: true
        }
      }
    }
  });

  if (!usuario || !usuario.activo) {
    return null;
  }

  const isValid = await verifyPassword(password, usuario.passwordHash);
  if (!isValid) {
    return null;
  }

  // Generate tokens
  const payload: Omit<JWTPayload, 'type'> = {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    cuentaId: usuario.doctorAsignadoId
  };

  const tokens = generateTokenPair(payload);

  // Store refresh token
  await storeRefreshToken(tokens.refreshToken, usuario.id, 'USUARIO_VINCULADO');

  return {
    user: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      cuentaId: usuario.doctorAsignadoId
    },
    tokens
  };
}

/**
 * Authenticate user (tries both Cuenta and UsuarioVinculado)
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<LoginResult | null> {
  // Try Cuenta first
  let result = await authenticateCuenta(email, password);
  if (result) {
    return result;
  }

  // Try UsuarioVinculado
  result = await authenticateUsuarioVinculado(email, password);
  return result;
}

/**
 * Refresh tokens using a valid refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<RefreshTokenResult> {
  // Verify JWT signature and expiration
  let payload: JWTPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }

  // Verify token exists in database and is not revoked
  const stored = await getStoredRefreshToken(refreshToken);
  if (!stored) {
    throw new Error('Refresh token not found or revoked');
  }

  // Get user info to ensure they still exist
  let userPayload: Omit<JWTPayload, 'type'>;

  if (stored.userType === 'CUENTA') {
    const cuenta = await prisma.cuenta.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, rol: true }
    });

    if (!cuenta) {
      throw new Error('User not found');
    }

    userPayload = {
      sub: cuenta.id,
      email: cuenta.email,
      rol: cuenta.rol
    };
  } else {
    const usuario = await prisma.usuarioVinculado.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        rol: true,
        doctorAsignadoId: true,
        activo: true
      }
    });

    if (!usuario || !usuario.activo) {
      throw new Error('User not found or inactive');
    }

    userPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      cuentaId: usuario.doctorAsignadoId
    };
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(userPayload);
  const newRefreshToken = generateRefreshToken(userPayload);

  // Rotate the refresh token (revoke old, store new)
  await rotateRefreshToken(refreshToken, newRefreshToken);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

/**
 * Logout user by revoking their refresh token
 */
export async function logoutUser(refreshToken: string): Promise<boolean> {
  return revokeRefreshToken(refreshToken);
}

/**
 * Logout user from all devices
 */
export async function logoutUserAllDevices(
  userId: string,
  userType: 'CUENTA' | 'USUARIO_VINCULADO'
): Promise<number> {
  return revokeAllUserTokens(userId, userType);
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  hashPassword,
  verifyPassword,
  authenticateUser,
  refreshTokens,
  logoutUser,
  logoutUserAllDevices,
  cleanupExpiredTokens
};
