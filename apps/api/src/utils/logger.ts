import pino, { type LoggerOptions } from 'pino';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Structured log context with error details
 */
export interface LogContext {
  error?: unknown;
  userId?: string;
  pacienteId?: string;
  consultaId?: string;
  [key: string]: unknown;
}

/**
 * Typed Pino Logger
 */
export interface Logger {
  fatal: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
  error: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
  warn: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
  info: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
  debug: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
  trace: (obj: LogContext | string, msg?: string, ...args: unknown[]) => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const isDevelopment = process.env.NODE_ENV !== 'production';

const pinoConfig: LoggerOptions = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: true
        }
      }
    : undefined
};

export const logger: Logger = pino(pinoConfig);

export default logger;
