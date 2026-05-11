// apps/api/src/routes/ia.routes.ts
import { Router } from 'express';
import { authMiddleware, requireDoctor } from '../middleware/auth.js';
import { rateLimitIA } from '../middleware/rateLimit.js';
import { geminiService } from '../services/ia/gemini-client.js';
import { buildConsultaContext } from '../services/consulta/context-service.js';
import brainRoutes from './ia/brain.routes.js';

const router: Router = Router();

// POST /ia/diagnostico - Generar códigos CIE-10 sugeridos
router.post('/diagnostico', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(), // 20 req/min (Bucket level)
  async (req: any,  res) => {
    try {
      const { evolucion, consultaId } = req.body;
      const userId = req.user.id;

      if (!evolucion || evolucion.length < 50) {
        return res.status(400).json({
          success: false, 
          error: 'La evolución debe tener al menos 50 caracteres'
        });
      }

      // Obtener contexto del paciente
      const contexto = await buildConsultaContext(consultaId);

      const diagnosticos = await geminiService.diagnosticarCIE10(userId,  evolucion,  contexto);

      res.json({
        success: true, 
        data: diagnosticos
      });
    } catch (error: any) {
      if (error.message === 'QUOTA_EXCEEDED') {
        return res.status(403).json({
          success: false,
          error: 'Has agotado tu cuota diaria de IA. Por favor, actualiza tu plan o espera a mañana.',
          code: 'AI_QUOTA_EXCEEDED'
        });
      }

      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// POST /ia/tratamiento - Sugerir tratamiento
router.post('/tratamiento', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req: any,  res) => {
    try {
      const { diagnostico, evolucion } = req.body;
      const userId = req.user.id;

      if (!diagnostico || !evolucion) {
        return res.status(400).json({
          success: false, 
          error: 'Diagnóstico y evolución son requeridos'
        });
      }

      const tratamiento = await geminiService.sugerirTratamiento(userId,  diagnostico,  evolucion);

      res.json({
        success: true, 
        data: tratamiento
      });
    } catch (error: any) {
      if (error.message === 'QUOTA_EXCEEDED') {
        return res.status(403).json({
          success: false,
          error: 'Has agotado tu cuota diaria de IA. Por favor, actualiza tu plan o espera a mañana.',
          code: 'AI_QUOTA_EXCEEDED'
        });
      }

      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// IA Brain routes
router.use('/brain',  brainRoutes);

export default router;
