import { Router } from 'express';
import { MetricsService, BusinessMetric } from '../services/monitoring/metrics.service.js';
import { logger } from '../utils/logger.js';

const router: Router = Router();

// Health check endpoint
router.get('/health',  (req,  res) => {
  try {
    // Basic health checks
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      pid: process.pid,
    };

    logger.info({ event: 'health_check',  status: 'healthy' });
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error({ event: 'health_check_error',  error });
    res.status(500).json({ status: 'unhealthy',  error: (error as Error).message });
  }
});

// Metrics endpoint
router.get('/metrics',  (req,  res) => {
  try {
    const metrics = MetricsService.getAllMetrics();
    
    // Format metrics in a simple way (in production,  you might want to use Prometheus format)
    const formattedMetrics = metrics.map(metric => ({
      name: metric.name, 
      type: metric.type, 
      value: metric.value, 
      labels: metric.labels, 
      timestamp: metric.timestamp?.toISOString(),
    }));

    logger.info({ event: 'metrics_requested',  count: formattedMetrics.length });
    res.status(200).json(formattedMetrics);
  } catch (error) {
    logger.error({ event: 'metrics_error',  error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Business metrics endpoint
router.get('/business-metrics',  (req,  res) => {
  try {
    const businessMetrics = {
      registrations: MetricsService.getMetrics(BusinessMetric.USER_REGISTRATION),
      logins: MetricsService.getMetrics(BusinessMetric.USER_LOGIN),
      consultasCreated: MetricsService.getMetrics(BusinessMetric.CONSULTA_CREATED),
      documentsGenerated: MetricsService.getMetrics(BusinessMetric.DOCUMENT_GENERATED),
      planUpgrades: MetricsService.getMetrics(BusinessMetric.PLAN_UPGRADE),
      planDowngrades: MetricsService.getMetrics(BusinessMetric.PLAN_DOWNGRADE),
      storageUsage: MetricsService.getMetrics(BusinessMetric.STORAGE_USAGE),
      apiRequests: MetricsService.getMetrics(BusinessMetric.API_REQUEST),
      errorsOccurred: MetricsService.getMetrics(BusinessMetric.ERROR_OCCURRED),
    };

    logger.info({ event: 'business_metrics_requested' });
    res.status(200).json(businessMetrics);
  } catch (error) {
    logger.error({ event: 'business_metrics_error',  error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// System metrics endpoint
router.get('/system-metrics',  (req,  res) => {
  try {
    const nodeProcess = process as NodeJS.Process & {
      loadavg(): number[];
      _getActiveHandles?(): unknown[];
      _getActiveRequests?(): unknown[];
    };
    const systemMetrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      loadAverage: nodeProcess.loadavg(),
      heapStatistics: (() => {
        try {
          return process.memoryUsage().heapUsed ? process.memoryUsage() : null;
        } catch (e) {
          return null;
        }
      })(),
      activeHandles: nodeProcess._getActiveHandles?.()?.length ?? 0,
      activeRequests: nodeProcess._getActiveRequests?.()?.length ?? 0,
    };

    logger.info({ event: 'system_metrics_requested' });
    res.status(200).json(systemMetrics);
  } catch (error) {
    logger.error({ event: 'system_metrics_error',  error });
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;