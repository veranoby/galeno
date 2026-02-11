import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { connectDatabase } from './config/database.js';
import redis, { checkRedisHealth } from './config/redis.js';
import { logger } from './utils/logger.js';

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
    description: 'Ecuador-Health 360 Medical Platform API'
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
