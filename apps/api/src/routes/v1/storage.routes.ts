import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest, authMiddleware, canAccessPatient } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import DocumentGeneratorService from '../../services/storage/document-generator.service.js';
import LocalStorageService from '../../services/storage/local-storage.service.js';
import TempStorageService from '../../services/storage/temp-storage.service.js';

const router: Router = Router();

// Inicializar servicios
const docGenerator = new DocumentGeneratorService();
const storage = new LocalStorageService();
const tempStorage = new TempStorageService();

// Configuración de Multer para uploads en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storage.getMaxFileSize()
  },
  fileFilter: (_req,  file,  cb) => {
    // Aceptar solo archivos .p12 para firmas
    if (file.originalname.endsWith('.p12')) {
      cb(null,  true);
    } else {
      cb(new Error('Solo se permiten archivos .p12'));
    }
  }
});

/**
 * @openapi
 * /api/v1/storage/download/{documentoId}:
 *   get:
 *     summary: Descargar documento PDF generado on-demand
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del documento a generar
 *     responses:
 *       200:
 *         description: PDF del documento generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Documento no encontrado
 *       403:
 *         description: Sin permisos para acceder al documento
 */
router.get('/download/:documentoId',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    // Asegurar que documentoId sea string
    const documentoId = Array.isArray(req.params.documentoId)
      ? req.params.documentoId[0]
      : req.params.documentoId;

    // Obtener documento con relaciones
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId }, 
      include: {
        consulta: {
          include: {
            paciente: true
          }
        }
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Documento no encontrado'
      });
    }

    // Verificar permisos usando lógica existente
    const hasAccess = await canAccessPatient(req,  documento.pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este documento'
      });
    }

    // Generar PDF on-demand con marca de agua si está caducado
    const pdfBuffer = await docGenerator.generateDocument(documentoId);

    // Determinar nombre del archivo
    const fileName = documento.archivoNombre ||
      `${documento.tipo}_${documento.consulta.paciente.nombre.replace(/\s+/g,  '_')}.pdf`;

    res.setHeader('Content-Type',  'application/pdf');
    res.setHeader('Content-Disposition',  `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length',  pdfBuffer.length);

    res.send(pdfBuffer);

    logger.info({
      documentoId, 
      userId: req.user?.id, 
      fileName
    },  'Documento generado y descargado');
  } catch (error) {
    logger.error({ error,  documentoId: req.params.documentoId },  'Error al generar documento');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al generar el documento'
    });
  }
});

/**
 * @openapi
 * /api/v1/storage/view/{documentoId}:
 *   get:
 *     summary: Ver documento PDF en navegador (inline)
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF del documento
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/view/:documentoId',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const documentoId = Array.isArray(req.params.documentoId)
      ? req.params.documentoId[0]
      : req.params.documentoId;

    const documento = await prisma.documento.findUnique({
      where: { id: documentoId }, 
      include: {
        consulta: {
          include: {
            paciente: true
          }
        }
      }
    });

    if (!documento) {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Documento no encontrado'
      });
    }

    const hasAccess = await canAccessPatient(req,  documento.pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este documento'
      });
    }

    const pdfBuffer = await docGenerator.generateDocument(documentoId);

    const fileName = documento.archivoNombre ||
      `${documento.tipo}_${documento.consulta.paciente.nombre.replace(/\s+/g,  '_')}.pdf`;

    res.setHeader('Content-Type',  'application/pdf');
    res.setHeader('Content-Disposition',  `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length',  pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error({ error,  documentoId: req.params.documentoId },  'Error al generar documento para vista');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al generar el documento'
    });
  }
});

/**
 * @openapi
 * /api/v1/storage/upload/firma:
 *   post:
 *     summary: Subir archivo de firma digital (.p12)
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo .p12 de firma digital
 *     responses:
 *       201:
 *         description: Archivo subido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     mimeType:
 *                       type: string
 *                     hash:
 *                       type: string
 *                     relativePath:
 *                       type: string
 *       400:
 *         description: Error en la validación del archivo
 */
router.post('/upload/firma',  authMiddleware,  upload.single('file'), async (req: AuthRequest,  res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'No se proporcionó ningún archivo'
      });
    }

    // Guardar archivo en almacenamiento permanente
    const result = await storage.saveFile(
      req.file.buffer, 
      req.file.originalname, 
      'uploads/firmas', 
      req.file.mimetype
    );

    res.status(201).json({
      data: {
        ...result, 
        downloadUrl: storage.getDownloadUrl(result.relativePath)
      }
    });

    logger.info({
      userId: req.user?.id, 
      fileName: result.originalName, 
      size: result.size
    },  'Archivo de firma subido exitosamente');
  } catch (error) {
    logger.error({ error },  'Error al subir archivo de firma');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al subir el archivo'
    });
  }
});

/**
 * @openapi
 * /api/v1/storage/upload/health-wallet/{pacienteId}:
 *   post:
 *     summary: Subir archivo al Health Wallet de un paciente
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - tipo
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               tipo:
 *                 type: string
 *                 description: Tipo de documento (ej. examen,  receta_externa)
 *     responses:
 *       201:
 *         description: Archivo subido exitosamente
 */
router.post('/upload/health-wallet/:pacienteId',  authMiddleware,  upload.single('file'), async (req: AuthRequest,  res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.pacienteId)
      ? req.params.pacienteId[0]
      : req.params.pacienteId;
    const { tipo } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'No se proporcionó ningún archivo'
      });
    }

    // Verificar acceso al paciente
    const hasAccess = await canAccessPatient(req,  pacienteId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    // Guardar en subdirectorio del paciente
    const relativePath = `uploads/health-wallet/${pacienteId}`;
    const result = await storage.saveFile(
      req.file.buffer, 
      req.file.originalname, 
      relativePath, 
      req.file.mimetype
    );

    res.status(201).json({
      data: {
        ...result, 
        tipo: tipo || 'documento', 
        pacienteId, 
        downloadUrl: storage.getDownloadUrl(result.relativePath)
      }
    });

    logger.info({
      userId: req.user?.id, 
      pacienteId, 
      fileName: result.originalName, 
      tipo
    },  'Archivo subido al Health Wallet');
  } catch (error) {
    logger.error({ error },  'Error al subir archivo al Health Wallet');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al subir el archivo'
    });
  }
});

/**
 * @openapi
 * /api/v1/storage/file/{path}:
 *   get:
 *     summary: Descargar archivo almacenado
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa del archivo
 *     responses:
 *       200:
 *         description: Archivo solicitado
 *       404:
 *         description: Archivo no encontrado
 */
router.get('/file/*',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    // req.params[0] contiene todo lo que está después de /file/
    const relativePath = Array.isArray(req.params[0])
      ? req.params[0][0]
      : req.params[0];

    if (!relativePath) {
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'Ruta de archivo no proporcionada'
      });
    }

    // Verificar si el archivo existe
    const exists = await storage.fileExists(relativePath);

    if (!exists) {
      return res.status(404).json({
        error: 'Not found', 
        message: 'Archivo no encontrado'
      });
    }

    // Leer archivo
    const fileBuffer = await storage.readFile(relativePath);

    // Determinar content type
    const ext = relativePath.split('.').pop() || '';
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'p12': 'application/x-pkcs12',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    const fileName = relativePath.split('/').pop() || 'archivo';

    res.setHeader('Content-Type',  contentType);
    res.setHeader('Content-Disposition',  `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length',  fileBuffer.length);

    res.send(fileBuffer);

    logger.info({
      userId: req.user?.id, 
      path: relativePath, 
      size: fileBuffer.length
    },  'Archivo descargado del almacenamiento');
  } catch (error) {
    logger.error({ error },  'Error al descargar archivo');
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Error al descargar el archivo'
    });
  }
});

/**
 * @openapi
 * /api/v1/storage/config:
 *   get:
 *     summary: Obtener configuración de almacenamiento
 *     tags: [Storage]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actual
 */
router.get('/config',  authMiddleware,  async (_req: AuthRequest,  res: Response) => {
  res.json({
    data: {
      maxFileSize: storage.getMaxFileSize(),
      storagePath: storage.getStoragePath(),
      tempPath: tempStorage.getTempPath(),
      allowedFileTypes: ['p12', 'pdf', 'png', 'jpg', 'jpeg', 'gif']
    }
  });
});

export default router;
