import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';

// Security configuration for Galeno API
// Compliance: LOPDP (Ley Orgánica de Protección de Datos Personales - Ecuador)

interface SecurityConfig {
  app: Express;
  isProduction: boolean;
}

export class SecurityConfigurator {
  constructor(private config: SecurityConfig) {}

  /**
   * Applies all security configurations to the Express app
   */
  configure(): void {
    // Apply Helmet security headers
    this.applyHelmet();

    // Configure CORS
    this.configureCors();

    // Apply rate limiting
    this.applyRateLimiting();

    // Additional security measures
    this.applyAdditionalSecurity();
  }

  /**
   * Applies Helmet security headers
   */
  private applyHelmet(): void {
    // Basic Helmet configuration
    this.config.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"], 
          styleSrc: ["'self'",  "'unsafe-inline'",  "fonts.googleapis.com",  "cdn.jsdelivr.net"], 
          fontSrc: ["'self'",  "fonts.gstatic.com",  "cdn.jsdelivr.net"], 
          scriptSrc: ["'self'",  "cdn.jsdelivr.net",  "'unsafe-inline'"], 
          imgSrc: ["'self'",  "data:",  "https:"], 
          connectSrc: ["'self'",  "https://*.sentry.io"],  // For Sentry error reporting
        }, 
      }, 
      hsts: {
        maxAge: 31536000,  // 1 year
        includeSubDomains: true, 
        preload: true
      }, 
      frameguard: {
        action: 'deny'
      }, 
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      }
    }));

    // Additional security headers
    this.config.app.use((req,  res,  next) => {
      // Prevent MIME-type sniffing
      res.setHeader('X-Content-Type-Options',  'nosniff');
      
      // Enable XSS protection
      res.setHeader('X-XSS-Protection',  '1; mode=block');
      
      // Disable caching for sensitive endpoints
      if (req.path.includes('/health-wallet') || req.path.includes('/consent')) {
        res.setHeader('Cache-Control',  'no-store,  no-cache,  must-revalidate,  proxy-revalidate');
        res.setHeader('Pragma',  'no-cache');
        res.setHeader('Expires',  '0');
      }
      
      next();
    });
  }

  /**
   * Configures CORS based on environment
   */
  private configureCors(): void {
    const corsOptions = this.config.isProduction 
      ? {
          origin: process.env.ALLOWED_ORIGINS?.split(', ') || ['https://galeno.ec', 'https://*.galeno.ec'],
          credentials: true,
          optionsSuccessStatus: 200,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: [
            'Origin', 
            'X-Requested-With', 
            'Content-Type', 
            'Accept', 
            'Authorization',
            'X-Client-Version',
            'X-Device-ID'
          ]
        }
      : {
          origin: '*',
          credentials: true,
          optionsSuccessStatus: 200
        };

    this.config.app.use(cors(corsOptions));
  }

  /**
   * Applies rate limiting
   */
  private applyRateLimiting(): void {
    // General rate limiter for API
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: this.config.isProduction ? 100 : 500,  // Limit each IP to 100 requests per windowMs for production
      message: {
        error: 'Too many requests from this IP,  please try again later.'
      }, 
      standardHeaders: true, 
      legacyHeaders: false, 
    });

    this.config.app.use('/api/',  apiLimiter);

    // Specific rate limiter for authentication endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 5,  // Limit each IP to 5 auth attempts per windowMs
      message: {
        error: 'Too many authentication attempts,  please try again later.'
      }, 
      skipSuccessfulRequests: true,  // Don't count successful logins towards limit
    });

    this.config.app.use('/api/v1/auth/',  authLimiter);
    this.config.app.use('/api/v1/onboarding/',  authLimiter);

    // Rate limiter for health wallet endpoints
    const healthWalletLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 20,  // Limit each IP to 20 health wallet requests per windowMs
      message: {
        error: 'Too many health wallet requests,  please try again later.'
      }
    });

    this.config.app.use('/api/v1/health-wallet/',  healthWalletLimiter);
  }

  /**
   * Applies additional security measures
   */
  private applyAdditionalSecurity(): void {
    // Hide powered by header
    this.config.app.disable('x-powered-by');

    // Security logging middleware
    this.config.app.use((req,  res,  next) => {
      const startTime = Date.now();
      
      res.on('finish',  () => {
        const duration = Date.now() - startTime;
        
        // Log suspicious activities
        if (duration > 10000) { // Request took more than 10 seconds
          console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
        }
        
        // Log security-relevant events
        if (req.path.includes('/health-wallet') || req.path.includes('/consent')) {
          console.log(`Security-sensitive endpoint accessed: ${req.method} ${req.path} by ${req.ip}`);
        }
      });
      
      next();
    });

    // Input sanitization middleware
    this.config.app.use((req,  res,  next) => {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
      }
      
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        sanitizeObject(req.query);
      }
      
      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        sanitizeObject(req.params);
      }
      
      next();
    });
  }
}

/**
 * Sanitizes an object by removing potentially dangerous content
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential SQL injection patterns
      obj[key] = obj[key]
        .replace(/(\b)(drop|delete|insert|update|select|create|alter|exec|execute|script|iframe|javascript:|vbscript:)\b/gi, '')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Export a function to easily configure security
export const configureSecurity = (app: Express,  isProduction: boolean = process.env.NODE_ENV === 'production'): void => {
  const securityConfig = new SecurityConfigurator({ app,  isProduction });
  securityConfig.configure();
};