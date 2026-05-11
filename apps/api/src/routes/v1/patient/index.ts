import { Router } from 'express';
import antecedentsRoutes from './antecedents.routes.js';
import antecedentsImportRoutes from './antecedents-import.routes.js';

const router: Router = Router();

// Rutas de antecedentes
router.use(antecedentsRoutes);
router.use(antecedentsImportRoutes);

export default router;