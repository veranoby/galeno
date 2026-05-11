import { Router } from 'express';
import disponibilidadRoutes from './agenda/disponibilidad.routes.js';
import reservasRoutes from './agenda/reservas.routes.js';
import citasRoutes from './agenda/citas.routes.js';

const router: Router = Router();

// Mount sub-routes under /api/v1/agenda
router.use('/disponibilidad',  disponibilidadRoutes);
router.use('/reservas',  reservasRoutes);
router.use('/citas',  citasRoutes);

export default router;