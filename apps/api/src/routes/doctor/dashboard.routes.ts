// apps/api/src/routes/doctor/dashboard.routes.ts
import { Router } from 'express';
import { authMiddleware, requireDoctor } from '../../middleware/auth.js';
import { getDoctorDashboardData } from '../../services/doctor/dashboard-service.js';

const router: Router = Router();

/**
 * GET /api/doctor/dashboard/metrics
 * Obtiene las métricas del dashboard del doctor
 * 
 * Headers:
 * - Authorization: Bearer {token}
 * 
 * Response:
 * - 200: { success: true, data: DashboardMetrics }
 * - 401: Unauthorized
 * - 500: Internal Server Error
 */
router.get('/metrics',  
  authMiddleware,  
  requireDoctor,  
  async (req,  res) => {
    try {
      const doctorId = req.user!.id;
      
      const dashboardData = await getDoctorDashboardData(doctorId);
      
      res.json({
        success: true, 
        data: dashboardData.metrics
      });
    } catch (error) {
      console.error('Error obteniendo métricas del dashboard:', error);
      res.status(500).json({
        success: false, 
        error: 'Error obteniendo métricas del dashboard'
      });
    }
  }
);

/**
 * GET /api/doctor/dashboard
 * Obtiene todos los datos del dashboard del doctor
 * 
 * Headers:
 * - Authorization: Bearer {token}
 * 
 * Response:
 * - 200: { success: true, data: DashboardData }
 * - 401: Unauthorized
 * - 500: Internal Server Error
 */
router.get('/',  
  authMiddleware,  
  requireDoctor,  
  async (req,  res) => {
    try {
      const doctorId = req.user!.id;
      
      const dashboardData = await getDoctorDashboardData(doctorId);
      
      res.json({
        success: true, 
        data: dashboardData
      });
    } catch (error) {
      console.error('Error obteniendo datos del dashboard:', error);
      res.status(500).json({
        success: false, 
        error: 'Error obteniendo datos del dashboard'
      });
    }
  }
);

export default router;