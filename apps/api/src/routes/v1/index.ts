import { Router, type RequestHandler } from 'express';
import authRoutes from './auth.routes.js';
import consultasRoutes from './consultas.routes.js';
import consultaSignatureRoutes from './consulta-signature.routes.js';
import documentosRoutes from './documentos.routes.js';
import firmaRoutes from './firma.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import pacientesRoutes from './pacientes.routes.js';
import patientRoutes from './patient/index.js';
import teleconsultaRoutes from './teleconsulta.routes.js';
import agendaRoutes from './agenda.routes.js';
import triageRoutes from './triage.routes.js';
import sriRoutes from '../sri/index.js';
import iaRoutes from '../ia.routes.js';
import temporalValidationRoutes from './temporal-validation.routes.js';
import notificationRoutes from './notification.routes.js';
import enhancedNotificationRoutes from './enhanced-notification.routes.js';
import billingRoutes from '../billing/index.js';
import interconsultasRoutes from './interconsultas.routes.js';
import modulesRoutes from './modules.routes.js';
import senescytRoutes from './senescyt.routes.js';
import locationRoutes from '../location/location.routes.js';
import specialtiesRoutes from './specialties.routes.js';
import ubicacionRoutes from './ubicacion.routes.js';
import paymentRoutes from './payment.routes.js';
import paymentWebhookRoutes from './payment-webhook.routes.js';
import doctorPublicRoutes from '../doctor/public.routes.js';
import shareRoutes from './share.routes.js';
import walletShareRoutes from './wallet/share.routes.js';
import healthWalletRoutes from './health-wallet.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import migrationRoutes from './migration.routes.js';
import pharmacyRoutes from './pharmacy.routes.js';
import whatsappWebhookRoutes from './whatsapp-webhook.routes.js';
import telemetryRoutes from '../telemetry.routes.js';
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
router.use('/consultas', consultaSignatureRoutes);

// Documentos routes: Rate limited by user (30 requests/min)
// Document management endpoint
router.use('/documentos', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), documentosRoutes);

// Firma routes: Rate limited by user (15 requests/min)
// Digital signature validation endpoint
router.use('/firma', rateLimitFirma(), firmaRoutes);

// Onboarding routes: Rate limited by IP (5 requests/min)
// New user registration and onboarding flow
router.use('/onboarding', rateLimitByIP(), onboardingRoutes);

// Patient routes: Rate limited by user (100 requests/min)
// Patient management and antecedentes endpoints
router.use('/patients', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), pacientesRoutes);
router.use('/patient', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), patientRoutes);

// SRI routes: Rate limited by user (30 requests/min)
// Electronic invoicing XML generation and validation
router.use('/sri', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), sriRoutes);

// IA routes: Rate limited by user (20 requests/min for diagnostic)
// AI-powered diagnostic and treatment suggestions
router.use('/ia', iaRoutes);

// Teleconsulta routes: Rate limited by user (30 requests/min)
// Video consultation endpoints with Jitsi Meet integration
router.use('/teleconsulta', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), teleconsultaRoutes);

// Agenda routes: Rate limited by user (100 requests/min)
// Appointments and availability management
router.use('/agenda', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), agendaRoutes);

// Triage routes: Rate limited by user (50 requests/min)
// TASK-012: Sistema de Triaje Colaborativo - Nurse captures vital signs, doctor receives SSE notification
router.use('/consultas', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), triageRoutes);

// Health Wallet Temporal Validation routes: Rate limited by user (30 requests/min)
// TASK-039: Temporal access to patient history during teleconsultations
router.use('/wallet/temporal', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), temporalValidationRoutes);

// Notification routes: Rate limited by user (50 requests/min)
// Standard and enhanced notification management
router.use('/notifications', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), notificationRoutes);
router.use('/notifications', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), enhancedNotificationRoutes);

// Billing routes: Rate limited by user (30 requests/min)
// Electronic invoicing CRUD and SRI authorization endpoints
router.use('/billing', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), billingRoutes);

// Interconsultas simplificadas routes: Rate limited by user (50 requests/min)
// TASK-046: Simplified interconsultation flow with tracking and manual closing
router.use('/interconsultas', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), interconsultasRoutes);

// Specialty Modules routes: Rate limited by user (50 requests/min)
// TASK-044B: Dynamic specialty modules (Odontograma, Retina Atlas, Curvas de Crecimiento)
router.use('/modules', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), modulesRoutes);

// SENESCYT Validation routes: Rate limited by user (30 requests/min)
// TASK-044C: Medical title validation against SENESCYT API
router.use('/senescyt', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), senescytRoutes);

// Location/GPS routes: Rate limited by user (50 requests/min)
// TASK-024: GPS dinámico y geolocalización para búsqueda de doctores cercanos
router.use('/location', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), locationRoutes);

// Specialties routes: Rate limited by user (100 requests/min)
// Medical specialties list and doctor specialties
router.use('/specialties', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), specialtiesRoutes);

// Ubicacion routes: Rate limited by user (100 requests/min)
// GPS, offices, doctors by location
router.use('/ubicacion', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), ubicacionRoutes);

// Payment routes: Rate limited by user (10 requests/min) - HIGH SECURITY
// TASK-018: Payment gateways (Payphone + Kushki)
router.use('/payments', rateLimit({ config: { limit: 10, windowSeconds: 60 } }), paymentRoutes);

// Payment webhooks routes: NO rate limiting (external providers)
// TASK-018: Webhook handlers for Payphone and Kushki
router.use('/payment', paymentWebhookRoutes);

// Doctor Public Profile routes: Rate limited (100 requests/min)
// TASK-051: Public doctor profiles with ratings
router.use('/doctor', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), doctorPublicRoutes);

// Share routes (LOPDP): Rate limited by user (30 requests/min)
// TASK-045: Protocolo para compartir historial médico LOPDP compliant
router.use('/share', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), shareRoutes);

// Wallet Share routes (ShareToken): Rate limited by user (30 requests/min)
// TASK-045: ShareToken protocol for patient-to-doctor data sharing via QR/link
router.use('/wallet/share', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), walletShareRoutes);

// Health Wallet routes: Rate limited by user (50 requests/min)
// Health Wallet management and consent authorization
router.use('/health-wallet', rateLimit({ config: { limit: 50, windowSeconds: 60 } }), healthWalletRoutes);

// Marketplace routes: Rate limited by user (30 requests/min)
// TASK-016: Marketplace de Módulos (WhatsApp, IA Pro, WebRTC Pro, Migración Pro)
router.use('/marketplace', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), marketplaceRoutes);

// Migration routes: Rate limited by user (10 requests/min)
// TASK-015: Migración Inteligente con IA (CSV, JSON, Excel)
router.use('/migration', rateLimit({ config: { limit: 10, windowSeconds: 60 } }), migrationRoutes);

// Pharmacy routes: Rate limited by user (30 requests/min)
// TASK-019: Validación QR Farmacias con acceso restringido por rol FARMACIA
router.use('/pharmacy', rateLimit({ config: { limit: 30, windowSeconds: 60 } }), pharmacyRoutes);

// WhatsApp Webhook: NO rate limit (Twilio calls this)
router.use('/whatsapp', whatsappWebhookRoutes);

// Telemetry routes: Rate limited by user (100 requests/min)
// TASK-OPT-002: Persistencia de telemetría para calidad de teleconsulta
router.use('/telemetry', rateLimit({ config: { limit: 100, windowSeconds: 60 } }), telemetryRoutes);

export default router;
