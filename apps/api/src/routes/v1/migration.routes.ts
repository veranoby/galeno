// apps/api/src/routes/v1/migration.routes.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authMiddleware } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { getMigrationQueue } from '../../queues/migration-queue.js';
import { AIStructurerService } from '../../services/migration/ai-structurer.js';
import type { AuthRequest } from '../../middleware/auth.js';

/**
 * Migration Routes
 * 
 * Endpoints para migración inteligente de datos
 * 
 * Features:
 * - Upload de archivos (CSV, JSON, Excel)
 * - Mapeo automático con IA
 * - Procesamiento asíncrono vía BullMQ
 * - Seguimiento de progreso en tiempo real
 */

const router: Router = Router();

// Configurar multer para upload de archivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'migration');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  const allowedExtensions = ['.csv', '.json', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo CSV, JSON o Excel'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  }
});

// ============= ROUTES =============

/**
 * @openapi
 * /api/v1/migration/upload:
 *   post:
 *     summary: Upload archivo para migración
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               targetModel:
 *                 type: string
 *                 enum: [Paciente, Consulta, Cita]
 *     responses:
 *       200:
 *         description: Archivo subido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     fileUrl:
 *                       type: string
 *                     status:
 *                       type: string
 */
router.post('/upload',
  authMiddleware,
  rateLimit({ config: { limit: 10, windowSeconds: 60 } }), // 10 uploads por minuto
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo'
        });
      }

      const { targetModel } = req.body;
      const validModels = ['Paciente', 'Consulta', 'Cita'];
      
      if (!targetModel || !validModels.includes(targetModel)) {
        // Limpiar archivo subido
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: `targetModel debe ser uno de: ${validModels.join(', ')}`
        });
      }

      // Determinar tipo de archivo
      const ext = path.extname(req.file.originalname).toLowerCase();
      let fileType: 'csv' | 'json' | 'excel';
      
      if (ext === '.csv') {
        fileType = 'csv';
      } else if (ext === '.json') {
        fileType = 'json';
      } else {
        fileType = 'excel';
      }

      // Crear job ID único
      const jobId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Encolar trabajo de migración
      const queue = getMigrationQueue();
      
      await queue.addMigrationJob({
        jobId,
        fileUrl: req.file.path,
        fileType,
        targetModel: targetModel as 'Paciente' | 'Consulta' | 'Cita',
        userId: req.user!.id
      }, {
        jobId
      });

      res.json({
        success: true,
        data: {
          jobId,
          fileName: req.file.originalname,
          fileUrl: req.file.path,
          fileType,
          targetModel,
          status: 'queued'
        }
      });
    } catch (error) {
      console.error('[Migration] Error en upload:', error);
      
      // Limpiar archivo si hubo error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error procesando archivo'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/analyze:
 *   post:
 *     summary: Analizar archivo y generar mapeo con IA
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileUrl:
 *                 type: string
 *               fileType:
 *                 type: string
 *                 enum: [csv, json, excel]
 *               targetModel:
 *                 type: string
 *                 enum: [Paciente, Consulta, Cita]
 *     responses:
 *       200:
 *         description: Mapeo generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sourceColumns:
 *                       type: array
 *                       items:
 *                         type: string
 *                     mappings:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalRows:
 *                       type: number
 *                     validRows:
 *                       type: number
 */
router.post('/analyze',
  authMiddleware,
  rateLimit({ config: { limit: 5, windowSeconds: 60 } }), // 5 análisis por minuto
  async (req: AuthRequest, res: Response) => {
    try {
      const { fileUrl, fileType, targetModel } = req.body;

      if (!fileUrl || !fileType || !targetModel) {
        return res.status(400).json({
          success: false,
          error: 'fileUrl, fileType y targetModel son requeridos'
        });
      }

      const aiStructurer = new AIStructurerService();
      
      // Leer archivo para obtener muestra
      const rawData = await aiStructurer['parseFile'](fileUrl, fileType);
      
      // Usar primeras 10 filas como muestra
      const sampleData = rawData.slice(0, 10);
      
      if (sampleData.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Archivo vacío'
        });
      }

      // Analizar y generar mapeo
      const mappingResult = await aiStructurer.analyzeAndMap(sampleData, targetModel);

      res.json({
        success: true,
        data: {
          sourceColumns: mappingResult.sourceColumns,
          mappings: mappingResult.mappings,
          totalRows: rawData.length,
          validRows: mappingResult.validRows,
          invalidRows: mappingResult.invalidRows,
          avgConfidence: mappingResult.mappings.reduce((sum, m) => sum + m.confidence, 0) / mappingResult.mappings.length
        }
      });
    } catch (error) {
      console.error('[Migration] Error analizando archivo:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Error analizando archivo'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/process:
 *   post:
 *     summary: Procesar migración con mapeo personalizado
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileUrl:
 *                 type: string
 *               fileType:
 *                 type: string
 *                 enum: [csv, json, excel]
 *               targetModel:
 *                 type: string
 *                 enum: [Paciente, Consulta, Cita]
 *               mappings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sourceColumn:
 *                       type: string
 *                     targetField:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                     transformation:
 *                       type: string
 *               skipAI:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Migración procesada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     status:
 *                       type: string
 */
router.post('/process',
  authMiddleware,
  rateLimit({ config: { limit: 5, windowSeconds: 60 } }), // 5 procesos por minuto
  async (req: AuthRequest, res: Response) => {
    try {
      const { fileUrl, fileType, targetModel, mappings, skipAI } = req.body;

      if (!fileUrl || !fileType || !targetModel) {
        return res.status(400).json({
          success: false,
          error: 'fileUrl, fileType y targetModel son requeridos'
        });
      }

      const jobId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const queue = getMigrationQueue();

      await queue.addMigrationJob({
        jobId,
        fileUrl,
        fileType,
        targetModel,
        userId: req.user!.id,
        mappings,
        skipAI: skipAI || false
      }, {
        jobId
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'queued'
        }
      });
    } catch (error) {
      console.error('[Migration] Error procesando migración:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Error procesando migración'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/status/:jobId:
 *   get:
 *     summary: Obtener estado de trabajo de migración
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado del trabajo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     progress:
 *                       type: number
 *                     result:
 *                       type: object
 */
router.get('/status/:jobId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
      const queue = getMigrationQueue();

      const job = await queue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Trabajo no encontrado'
        });
      }

      const state = await job.getState();
      const progress = job.progress as number;
      const result = job.returnvalue;

      res.json({
        success: true,
        data: {
          jobId,
          status: state,
          progress,
          result,
          failedReason: job.failedReason
        }
      });
    } catch (error) {
      console.error('[Migration] Error obteniendo estado:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo estado'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/jobs:
 *   get:
 *     summary: Listar trabajos de migración del usuario
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, active, completed, failed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de trabajos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/jobs',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as { status?: string; limit?: string };
      const status = query.status;
      const limit = query.limit || '20';
      const queue = getMigrationQueue();

      let jobs;
      const start = 0;
      const limitNum = parseInt(limit) - 1;
      const end = Math.max(0, limitNum);

      switch (status) {
        case 'waiting':
          jobs = await queue.getWaitingJobs(start, end);
          break;
        case 'active':
          jobs = await queue.getActiveJobs(start, end);
          break;
        case 'completed':
          jobs = await queue.getCompletedJobs(start, end);
          break;
        case 'failed':
          jobs = await queue.getFailedJobs(start, end);
          break;
        default:
          // Por defecto, mostrar trabajos activos y en espera
          const waiting = await queue.getWaitingJobs(0, 9);
          const active = await queue.getActiveJobs(0, 9);
          jobs = [...waiting, ...active];
      }

      const jobList = jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.getState(),
        progress: job.progress as number,
        timestamp: job.timestamp,
        data: job.data
      }));

      res.json({
        success: true,
        data: jobList
      });
    } catch (error) {
      console.error('[Migration] Error listando trabajos:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Error listando trabajos'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/cancel/:jobId:
 *   post:
 *     summary: Cancelar trabajo de migración
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trabajo cancelado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.post('/cancel/:jobId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
      const queue = getMigrationQueue();

      await queue.cancelJob(jobId);

      res.json({
        success: true
      });
    } catch (error) {
      console.error('[Migration] Error cancelando trabajo:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error cancelando trabajo'
      });
    }
  }
);

/**
 * @openapi
 * /api/v1/migration/queue-info:
 *   get:
 *     summary: Obtener información de la cola
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de la cola
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     counts:
 *                       type: object
 *                     isPaused:
 *                       type: boolean
 */
router.get('/queue-info',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const queue = getMigrationQueue();
      const info = await queue.getQueueInfo();

      res.json({
        success: true,
        data: info
      });
    } catch (error) {
      console.error('[Migration] Error obteniendo info de cola:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo información'
      });
    }
  }
);

export default router;
