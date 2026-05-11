/**
 * Sentry configuration for backend error tracking and monitoring
 */
import * as Sentry from '@sentry/node';

interface SentryConfig {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

/**
 * Initialize Sentry for backend
 */
export function initSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) {
    console.log('[Sentry] Disabled or missing DSN');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    integrations: [
      // Express integration for automatic request tracking
      Sentry.expressIntegration(),
      // HTTP integration for tracking outgoing requests
      Sentry.httpIntegration(),
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture exception with Sentry
 */
export function captureException(error: Error, context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}): void {
  if (!Sentry.isInitialized()) {
    console.error('[Sentry] Not initialized, logging error instead:', error);
    return;
  }

  const scope = Sentry.getCurrentScope();

  // Add tags
  if (context?.tags) {
    Object.entries(context.tags).forEach(([key, value]) => {
      scope.setTag(key, value);
    });
  }

  // Add extra context
  if (context?.extra) {
    scope.setExtras(context.extra);
  }

  // Set user context
  if (context?.user) {
    scope.setUser({
      id: context.user.id,
      email: context.user.email,
      username: context.user.username,
    });
  }

  Sentry.captureException(error);
}

/**
 * Capture message with Sentry
 */
export function captureMessage(message: string, options?: {
  level?: 'fatal' | 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}): void {
  if (!Sentry.isInitialized()) {
    console.log('[Sentry Message]', message);
    return;
  }

  const scope = Sentry.getCurrentScope();

  // Set level
  if (options?.level) {
    scope.setLevel(options.level);
  }

  // Add tags
  if (options?.tags) {
    Object.entries(options.tags).forEach(([key, value]) => {
      scope.setTag(key, value);
    });
  }

  // Add extra context
  if (options?.extra) {
    scope.setExtras(options.extra);
  }

  Sentry.captureMessage(message);
}

/**
 * Set user context for Sentry
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  if (Sentry.isInitialized()) {
    Sentry.setUser(user);
  }
}

/**
 * Set tag for Sentry
 */
export function setTag(key: string, value: string): void {
  if (Sentry.isInitialized()) {
    Sentry.setTag(key, value);
  }
}

/**
 * Add breadcrumb for Sentry
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  data?: Record<string, any>;
}): void {
  if (Sentry.isInitialized()) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(context: {
  name: string;
  op?: string;
  tags?: Record<string, string>;
}): Sentry.Span | undefined {
  if (!Sentry.isInitialized()) {
    return undefined;
  }

  const transaction = Sentry.startSpan({
    name: context.name,
    op: context.op || 'function',
  }, (span) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
    return span;
  });

  return transaction;
}

/**
 * Create Sentry middleware for Express
 * Note: In Sentry Node SDK v8+, use wrapExpressHandler instead
 */
export function sentryRequestHandler() {
  if (!Sentry.isInitialized()) {
    return (req: any, res: any, next: any) => next();
  }

  // For Sentry Node SDK v8+, wrap the request
  return (req: any, res: any, next: any) => {
    Sentry.withIsolationScope((scope) => {
      scope.setTransactionName(`${req.method} ${req.path}`);
      next();
    });
  };
}

/**
 * Create Sentry error handler for Express
 */
export function sentryErrorHandler() {
  if (!Sentry.isInitialized()) {
    return (err: any, req: any, res: any, next: any) => next(err);
  }

  return (err: any, req: any, res: any, next: any) => {
    captureException(err);
    next(err);
  };
}

/**
 * Flush pending events to Sentry
 */
export async function flushSentry(timeout?: number): Promise<boolean> {
  if (!Sentry.isInitialized()) {
    return true;
  }

  return Sentry.flush(timeout);
}

/**
 * Close Sentry connection
 */
export async function closeSentry(timeout?: number): Promise<boolean> {
  if (!Sentry.isInitialized()) {
    return true;
  }

  return Sentry.close(timeout);
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  setTag,
  addBreadcrumb,
  startTransaction,
  sentryRequestHandler,
  sentryErrorHandler,
  flushSentry,
  closeSentry,
};
