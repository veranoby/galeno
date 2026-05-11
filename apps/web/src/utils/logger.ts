import * as Sentry from '@sentry/vue';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogContext {
  error?: unknown;
  userId?: string;
  pacienteId?: string;
  consultaId?: string;
  [key: string]: unknown;
}

export const logger = {
  fatal: (msg: string, context?: LogContext) => {
    console.error(`[FATAL] ${msg}`, context);
    if (context?.error instanceof Error) {
      Sentry.captureException(context.error, { extra: context });
    } else {
      Sentry.captureMessage(msg, { level: 'fatal', extra: context });
    }
  },
  error: (msg: string, context?: LogContext) => {
    console.error(`[ERROR] ${msg}`, context);
    if (context?.error instanceof Error) {
      Sentry.captureException(context.error, { extra: context });
    } else {
      Sentry.captureMessage(msg, { level: 'error', extra: context });
    }
  },
  warn: (msg: string, context?: LogContext) => {
    console.warn(`[WARN] ${msg}`, context);
    Sentry.captureMessage(msg, { level: 'warning', extra: context });
  },
  info: (msg: string, context?: LogContext) => {
    console.log(`[INFO] ${msg}`, context);
  },
  debug: (msg: string, context?: LogContext) => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${msg}`, context);
    }
  },
  trace: (msg: string, context?: LogContext) => {
    if (import.meta.env.DEV) {
      console.trace(`[TRACE] ${msg}`, context);
    }
  },
  setUser: (user: { id: string; email?: string; username?: string } | null) => {
    Sentry.setUser(user);
  },
  setTag: (key: string, value: string) => {
    Sentry.setTag(key, value);
  }
};

export default logger;
