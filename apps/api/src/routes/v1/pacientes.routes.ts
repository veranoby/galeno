// apps/api/src/routes/v1/pacientes.routes.ts
import { Router } from 'express';
import { authMiddleware, requireDoctor, canAccessPatient } from '../../middleware/auth.js';
import { getAlertasPaciente } from '../../services/paciente/alertas-service.js';
import { pacienteService } from '../../services/paciente/paciente-service.js';

const router: Router = Router();

/**
 * GET /api/v1/pacientes/:id
 * Obtiene la información básica de un paciente
 */
router.get('/:id',  
  authMiddleware,  
  requireDoctor,  
  async (req,  res) => {
    try {
      const { id } = req.params as { id: string };

      // Verificar acceso al paciente
      const puedeAcceder = await canAccessPatient(req as any,  id);
      if (!puedeAcceder) {
        return res.status(403).json({
          success: false, 
          error: 'No tiene permiso para acceder a este paciente'
        });
      }

      const paciente = await pacienteService.findById(id);
      if (!paciente) {
        return res.status(404).json({
          success: false, 
          error: 'Paciente no encontrado'
        });
      }

      res.json({
        success: true, 
        data: paciente
      });
    } catch (error: any) {
      res.status(500).json({
        success: false, 
        error: error.message || 'Error obteniendo información del paciente'
      });
    }
  }
);

/**
 * GET /api/v1/pacientes/:id/alertas
 * Obtiene las alertas clínicas de un paciente
 * 
 * Headers:
 * - Authorization: Bearer {token}
 * 
 * Params:
 * - id: ID del paciente
 * 
 * Query:
 * - tipo: Filtrar por tipo de alerta (opcional)
 * - severidad: Filtrar por severidad (opcional)
 * 
 * Response:
 * - 200: { success: true, data: AlertaClinica[] }
 * - 401: Unauthorized
 * - 403: Forbidden (no acceso al paciente)
 * - 404: Paciente no encontrado
 * - 500: Internal Server Error
 */
router.get('/:id/alertas',  
  authMiddleware,  
  requireDoctor,  
  async (req,  res) => {
    try {
      const { id: pacienteId } = req.params;
      const { tipo, severidad } = req.query;

      // Validar que pacienteId es un string
      if (typeof pacienteId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'ID de paciente inválido'
        });
      }

      // Verificar si el doctor puede acceder al paciente
      const puedeAcceder = await canAccessPatient(req as any,  pacienteId);
      if (!puedeAcceder) {
        return res.status(403).json({
          success: false, 
          error: 'No tiene permiso para acceder a este paciente'
        });
      }

      const alertas = await getAlertasPaciente(pacienteId as string);

      // Filtrar por tipo si se especifica
      let filteredAlertas = alertas;
      if (tipo) {
        filteredAlertas = filteredAlertas.filter(alerta => alerta.tipo === tipo);
      }
      if (severidad) {
        filteredAlertas = filteredAlertas.filter(alerta => alerta.severidad === severidad);
      }

      res.json({
        success: true, 
        data: filteredAlertas
      });
    } catch (error: any) {
      console.error('Error obteniendo alertas del paciente:', error);
      res.status(500).json({
        success: false, 
        error: error.message || 'Error obteniendo alertas del paciente'
      });
    }
  }
);

export default router;