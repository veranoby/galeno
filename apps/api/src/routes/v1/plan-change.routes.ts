import { Router, Response } from 'express';
import { Prisma, Plan } from '@prisma/client';
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { getPlanConfig } from '../../services/plan/config.js';
import { PlanChangeHistoryService } from '../../services/plan/plan-change-history.service.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/plan/current:
 *   get:
 *     summary: Get current plan information
 */
router.get('/current',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.rol;
    
    // For linked users, we want the plan of the main account
    const accountId = (userRole === 'DOCTOR' || userRole === 'ADMIN') ? userId : req.user!.cuentaId;

    if (!accountId) {
      return res.status(400).json({ error: 'Account context not found' });
    }

    // Get account with plan information
    const cuenta = await prisma.cuenta.findUnique({
      where: { id: accountId }, 
      include: {
        planLimites: true
      }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const plan = cuenta.plan || Plan.FREE;
    const config = getPlanConfig(plan);

    // Calculate usage
    // Main account is a doctor, plus linked doctors if any (though currently Cuenta is 1:1 with Doctor)
    const doctorsCount = 1; // Simplification for now: each Cuenta is one Doctor

    const assistantsCount = await prisma.usuarioVinculado.count({
      where: {
        cuentaId: accountId, 
        rol: 'ASISTENTE'
      }
    });

    // Calculate storage usage from documents linked to this account's consultations
    const documentos = await prisma.documento.findMany({
      where: {
        consulta: {
          cuentaId: accountId
        }
      }, 
      select: {
        archivoSize: true
      }
    });

    const storageUsedBytes = documentos.reduce((sum, doc) => sum + (doc.archivoSize || 0), 0);
    const storageUsedMB = storageUsedBytes / (1024 * 1024);

    // Determine storage limit based on plan
    let storageLimitMB: number;
    if (plan === Plan.CLINICA_SME) {
      storageLimitMB = doctorsCount * 500; // 500MB per doctor
    } else {
      storageLimitMB = cuenta.planLimites?.maxAlmacenamientoMB ?? config.limites.maxAlmacenamientoMB;
    }

    const planInfo = {
      plan,
      config: {
        ...config,
        limites: {
          ...config.limites,
          maxDoctores: cuenta.planLimites?.maxDoctores ?? config.limites.maxDoctores,
          maxAsistentes: cuenta.planLimites?.maxAsistentes ?? config.limites.maxAsistentes,
          maxAlmacenamientoMB: cuenta.planLimites?.maxAlmacenamientoMB ?? config.limites.maxAlmacenamientoMB
        }
      },
      usage: {
        doctors: {
          current: doctorsCount,
          limit: cuenta.planLimites?.maxDoctores ?? config.limites.maxDoctores
        },
        assistants: {
          current: assistantsCount,
          limit: cuenta.planLimites?.maxAsistentes ?? config.limites.maxAsistentes
        },
        storage: {
          usedMB: parseFloat(storageUsedMB.toFixed(2)),
          limitMB: storageLimitMB,
          percentageUsed: storageLimitMB > 0 ? parseFloat(((storageUsedMB / storageLimitMB) * 100).toFixed(2)) : 0
        }
      }
    };

    res.json(planInfo);
  } catch (error) {
    logger.error({ error },  'Error fetching current plan');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/plan/available:
 *   get:
 *     summary: Get available plans
 */
router.get('/available',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.rol;
    const accountId = (userRole === 'DOCTOR' || userRole === 'ADMIN') ? userId : req.user!.cuentaId;

    if (!accountId) {
      return res.status(400).json({ error: 'Account context not found' });
    }

    const cuenta = await prisma.cuenta.findUnique({
      where: { id: accountId },
      select: { plan: true }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const currentPlan = cuenta.plan || Plan.FREE;

    // Get all available plans
    const availablePlans = Object.entries(getAvailablePlans(currentPlan)).map(([plan,  config]) => ({
      plan, 
      ...config
    }));

    res.json({ plans: availablePlans });
  } catch (error) {
    logger.error({ error },  'Error fetching available plans');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getAvailablePlans(currentPlan: Plan) {
  const planTransitions: Record<Plan, Plan[]> = {
    FREE: [Plan.PREMIUM, Plan.CLINICA_SME],
    PREMIUM: [Plan.FREE, Plan.CLINICA_SME],
    CLINICA_SME: [Plan.FREE, Plan.PREMIUM]
  };

  const availablePlanNames = planTransitions[currentPlan] || [];
  const allConfigs = {
    FREE: getPlanConfig(Plan.FREE),
    PREMIUM: getPlanConfig(Plan.PREMIUM),
    CLINICA_SME: getPlanConfig(Plan.CLINICA_SME)
  };

  const availablePlans: Record<string, any> = {};
  availablePlanNames.forEach(plan => {
    availablePlans[plan] = allConfigs[plan];
  });

  return availablePlans;
}

/**
 * @openapi
 * /api/v1/plan/change:
 *   post:
 *     summary: Change plan
 */
router.post('/change',  
  authMiddleware, 
  requireRole('DOCTOR',  'ADMIN'),
  async (req: AuthRequest,  res: Response) => {
    try {
      const { plan: newPlan, customLimits } = req.body;
      const userId = req.user!.id;

      if (!newPlan || !Object.values(Plan).includes(newPlan as Plan)) {
        return res.status(400).json({ 
          error: 'Invalid plan', 
          message: 'Plan must be one of FREE, PREMIUM, or CLINICA_SME'
        });
      }

      const cuenta = await prisma.cuenta.findUnique({
        where: { id: userId },
        include: { planLimites: true }
      });

      if (!cuenta) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const currentPlan = cuenta.plan || Plan.FREE;

      const availablePlans = getAvailablePlans(currentPlan);
      if (!availablePlans[newPlan]) {
        return res.status(403).json({ 
          error: 'Plan change not allowed', 
          message: `Cannot change from ${currentPlan} to ${newPlan}`
        });
      }

      if (isDowngrade(currentPlan, newPlan as Plan)) {
        const validation = await validateDowngrade(userId, newPlan as Plan);
        if (!validation.valid) {
          return res.status(403).json({ 
            error: 'Downgrade not allowed', 
            message: validation.error
          });
        }
      }

      // Update account plan
      const updatedAccount = await prisma.$transaction(async (tx) => {
        // Update main plan
        const acc = await tx.cuenta.update({
          where: { id: userId },
          data: { plan: newPlan as Plan }
        });

        // Update or create limits
        if (newPlan === Plan.CLINICA_SME && customLimits) {
          await tx.planLimites.upsert({
            where: { cuentaId: userId },
            create: {
              cuentaId: userId,
              maxDoctores: customLimits.maxDoctores || 1,
              maxAsistentes: customLimits.maxAsistentes || 0,
              maxAlmacenamientoMB: customLimits.maxAlmacenamientoMB || 500
            },
            update: {
              maxDoctores: customLimits.maxDoctores || undefined,
              maxAsistentes: customLimits.maxAsistentes || undefined,
              maxAlmacenamientoMB: customLimits.maxAlmacenamientoMB || undefined
            }
          });
        } else {
          // Reset limits for standard plans
          await tx.planLimites.deleteMany({ where: { cuentaId: userId } });
        }

        return acc;
      });

      logger.info({
        event: 'plan_changed', 
        accountId: userId, 
        userId, 
        fromPlan: currentPlan, 
        toPlan: newPlan
      }, 'Plan changed successfully');

      await PlanChangeHistoryService.logPlanChange(
        userId, 
        userId, 
        currentPlan, 
        newPlan as Plan, 
        `Plan changed from ${currentPlan} to ${newPlan}`, 
        { customLimits, trigger: 'user_initiated' }, 
        req
      );

      const planConfig = getPlanConfig(newPlan as Plan);
      res.json({
        plan: updatedAccount.plan,
        config: planConfig,
        message: `Plan successfully changed from ${currentPlan} to ${newPlan}`
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error({ error,  code: error.code },  'Prisma error changing plan');
        return res.status(400).json({ error: 'Database error',  message: error.message });
      }
      
      logger.error({ error },  'Error changing plan');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

function isDowngrade(currentPlan: Plan,  newPlan: Plan): boolean {
  const planPriority: Record<Plan, number> = {
    [Plan.FREE]: 1,
    [Plan.PREMIUM]: 2,
    [Plan.CLINICA_SME]: 3
  };
  return planPriority[currentPlan] > planPriority[newPlan];
}

router.get('/history',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req: AuthRequest,  res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user!.id;

    const history = await PlanChangeHistoryService.getPlanChangeHistory(
      userId, 
      parseInt(limit as string) || 50,
      parseInt(offset as string) || 0
    );

    const totalCount = await prisma.auditLog.count({
      where: {
        resourceId: userId, 
        action: 'PLAN_CHANGE'
      }
    });

    res.json({ history,  totalCount });
  } catch (error) {
    logger.error({ error },  'Error fetching plan change history');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history/stats',  authMiddleware,  requireRole('DOCTOR',  'ADMIN'), async (req: AuthRequest,  res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await PlanChangeHistoryService.getPlanChangeStats(userId);
    res.json(stats);
  } catch (error) {
    logger.error({ error },  'Error fetching plan change stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function validateDowngrade(accountId: string,  newPlan: Plan) {
  const config = getPlanConfig(newPlan);

  // Simple validation for now
  const assistantsCount = await prisma.usuarioVinculado.count({
    where: { cuentaId: accountId, rol: 'ASISTENTE' }
  });

  if (assistantsCount > config.limites.maxAsistentes) {
    return {
      valid: false,
      error: `Current assistants count (${assistantsCount}) exceeds new plan limit (${config.limites.maxAsistentes})`
    };
  }

  return { valid: true };
}

export default router;
