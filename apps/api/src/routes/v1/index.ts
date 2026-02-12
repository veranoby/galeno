import { Router, type RequestHandler } from 'express';
import authRoutes from './auth.routes.js';
import consultasRoutes from './consultas.routes.js';
import firmaRoutes from './firma.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import { rateLimitByIP, rateLimitConsultas, rateLimitFirma, rateLimit } from '../../middleware/rateLimit.js';

const router: Router = Router();

/**
 * @openapi
 * /:
 *   get:
 *     summary: API v1 Information
 *     tags: [General]
 *     description: Returns information about the current API version
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 version:
 *                   type: string
 *                 description:
 *                   type: string
 *                 security:
 *                   type: string
 *             example:
 *               name: Galeno API
 *               version: 1.0.0
 *               description: Ecuador-Health 360 Medical Platform API
 *               security: Row Level Security (RLS) enabled
 */
router.get('/', (_req, res) => {
  res.json({
    name: 'Galeno API',
    version: '1.0.0',
    description: 'Ecuador-Health 360 Medical Platform API',
    security: 'Row Level Security (RLS) enabled'
  });
});

// ============= SEC-001: RATE LIMITING =============
// Rate limiting configuration per route group
// For more information: apps/api/src/middleware/rateLimit.ts

// Auth routes: Rate limited by IP (10 requests/min)
// Prevents brute force attacks on login/register endpoints
router.use('/auth', rateLimitByIP(), authRoutes);

// Consultas routes: Rate limited by user (50 requests/min)
// Medical consultations endpoint with moderate rate limiting
router.use('/consultas', rateLimitConsultas(), consultasRoutes);

// Firma routes: Rate limited by user (15 requests/min)
// Digital signature validation endpoint
router.use('/firma', rateLimitFirma(), firmaRoutes);

// Onboarding routes: Rate limited by IP (5 requests/min)
// New user registration and onboarding flow
router.use('/onboarding', rateLimitByIP(), onboardingRoutes);

export default router;
