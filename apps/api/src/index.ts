import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { connectDatabase } from './config/database.js';
import redis, { checkRedisHealth } from './config/redis.js';
import { logger } from './utils/logger.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from './middleware/auth.js';

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

// ============= HEALTH CHECK =============
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

// ============= API ROUTES =============
app.get('/api', (_req, res) => {
  res.json({
    name: 'Galeno API',
    version: '1.0.0',
    description: 'Ecuador-Health 360 Medical Platform API',
    security: 'Row Level Security (RLS) enabled'
  });
});

// ============= AUTH ROUTES (sin protección) =============

// Login endpoint (TODO: Implement with JWT)
app.post('/api/auth/login', async (req: AuthRequest, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password required'
    });
  }

  // TODO: Implement proper JWT authentication
  // For development, return a mock token
  const mockToken = Buffer.from(JSON.stringify({
    sub: 'dev-user-id',
    email: email,
    rol: 'DOCTOR'
  })).toString('base64');

  res.json({
    token: mockToken,
    user: {
      id: 'dev-user-id',
      email: email,
      rol: 'DOCTOR'
    }
  });
});

// ============= PROTECTED ROUTES (con RLS) =============

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
    logger.error('Error fetching pacientes', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch pacientes'
    });
  }
});

// Ejemplo: Obtener consultas del usuario actual
app.get('/api/consultas', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const prisma = (await import('./config/database.js')).default;

    const consultas = await prisma.consulta.findMany({
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      count: consultas.length,
      data: consultas
    });
  } catch (error) {
    logger.error('Error fetching consultas', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch consultas'
    });
  }
});

// Ejemplo: Verificar contexto de autenticación
app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  res.json({
    user: req.user
  });
});

// ============= ERROR HANDLING =============
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
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
  try {
    // Connect to database
    await connectDatabase();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📚 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔧 API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
