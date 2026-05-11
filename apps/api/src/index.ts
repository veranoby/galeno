import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { connectDatabase } from './config/database.js';
import redis, { checkRedisHealth } from './config/redis.js';
import { logger } from './utils/logger.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from './middleware/auth.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import v1Routes from './routes/v1/index.js';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============= MIDDLEWARE =============
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= SWAGGER DOCUMENTATION =============
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Galeno API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true
  }
}));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Returns the health status of the API and its dependencies
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                     redis:
 *                       type: string
 *             example:
 *               status: ok
 *               timestamp: 2024-01-01T00:00:00.000Z
 *               uptime: 123.456
 *               services:
 *                 database: connected
 *                 redis: connected
 */
app.get('/health', async (_req, res) => {
  const dbHealthy = await checkRedisHealth();
  const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'connected', // PostgreSQL (checked at startup)
      redis: redisStatus
    }
  });
});

/**
 * @openapi
 * /api:
 *   get:
 *     summary: API Root
 *     tags: [General]
 *     description: Returns API information and available versions
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
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       version:
 *                         type: string
 *                       path:
 *                         type: string
 *                       status:
 *                         type: string
 *                 documentation:
 *                   type: string
 *             example:
 *               name: Galeno API
 *               version: 1.0.0
 *               description: Ecuador-Health 360 Medical Platform API
 *               versions:
 *                 - version: v1
 *                   path: /api/v1
 *                   status: current
 *               documentation: /api-docs
 */
app.get('/api', (_req, res) => {
  res.json({
    name: 'Galeno API',
    version: '1.0.0',
    description: 'Ecuador-Health 360 Medical Platform API',
    versions: [
      {
        version: 'v1',
        path: '/api/v1',
        status: 'current'
      }
    ],
    documentation: '/api-docs'
  });
});

// ============= API VERSIONING =============
// Mount v1 routes
app.use('/api/v1', v1Routes);

// ============= LEGACY ROUTES (for backward compatibility) =============
// These will be deprecated in future versions

// Ejemplo: Obtener pacientes del usuario actual
// RLS filtra automáticamente para mostrar solo los pacientes del usuario
app.get('/api/pacientes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const prisma = (await import('./config/database.js')).default;

    // RLS policy automáticamente filtra:
    // - DOCTORES: Solo sus pacientes
    // - ASISTENTES/ENFERMERAS: Pacientes del doctor asignado
    // - ADMIN: Todos los pacientes
    const pacientes = await prisma.paciente.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      count: pacientes.length,
      data: pacientes
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching pacientes');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch pacientes'
    });
  }
});


// ============= ERROR HANDLING =============
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============= 404 =============
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============= START SERVER =============
async function startServer() {
  let diContainer: ReturnType<typeof import('./di-container.js').getDIContainer> | null = null;

  try {
    // Connect to database
    await connectDatabase();

    // Inicializar DI Container dentro de startServer (evita module-level pollution)
    // OPTIMIZACIÓN: Solo inicializar cuando realmente se inicia el servidor
    const { getDIContainer } = await import('./di-container.js');
    diContainer = getDIContainer();

    // Log DI Container status solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const registeredServices = Object.keys(diContainer.registrations);
      logger.debug({
        services: registeredServices.length,
        names: registeredServices.slice(0, 10).join(', ')
      }, 'DI Container servicios registrados');
      logger.info(`🔧 DI Container: ${registeredServices.length} servicios registrados`);
    }

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📚 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔧 API endpoint: http://localhost:${PORT}/api`);
      logger.info(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`📋 API v1: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Solo iniciar servidor si no es un test
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Exportar app para tests
export default app;

// Exportar funciones DI para uso en otros módulos (diContainer NO exportado aquí)
export { getDIContainer, createScopedContainer, registerService } from './di-container.js';
