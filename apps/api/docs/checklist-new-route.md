# Checklist para Nuevas Rutas Express

Este documento establece el patrón correcto para crear nuevos archivos de rutas en la API de Galeno.

## ✅ Patrón Correcto

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  try {
    res.json({ status: 'healthy' });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

## ❌ Patrón Incorrecto (NO USAR)

```typescript
// NO hacer esto:
import express from 'express';
const router = express.Router() as express.Router;  // ❌ TS2742
```

## Reglas de Oro

### 1. Import Destructuring
Importar solo lo necesario de 'express':

```typescript
// ✅ CORRECTO
import { Router, Request, Response, json, raw } from 'express';

// ❌ INCORRECTO
import express from 'express';
```

### 2. Type Annotation Explícito
Usar anotación de tipo explícita para el router:

```typescript
// ✅ CORRECTO
const router: Router = Router();

// ❌ INCORRECTO
const router = express.Router() as express.Router;
```

### 3. Middlewares de Express
Para middlewares como `json()` y `raw()`, importarlos directamente:

```typescript
// ✅ CORRECTO
import { Router, json, raw } from 'express';

router.post('/webhook', json(), handler);
router.post('/stripe', raw({ type: 'application/json' }), handler);

// ❌ INCORRECTO
router.post('/webhook', express.json(), handler);
```

### 4. Tipos de Request/Response
Para handlers de ruta, usar tipos explícitos cuando sea necesario:

```typescript
// Con tipos personalizados (AuthRequest)
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  // ...
});

// Con tipos estándar
router.get('/health', (req: Request, res: Response) => {
  // ...
});

// Sin tipos (inferidos)
router.get('/simple', (req, res) => {
  // ...
});
```

## Orden de Imports

Mantener este orden consistente:

```typescript
// 1. Express
import { Router, Request, Response } from 'express';

// 2. Prisma / Modelos
import { Prisma, Plan } from '@prisma/client';

// 3. Middleware
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.js';

// 4. Servicios
import { MyService } from '../../services/my-service.js';

// 5. Utils
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

// 6. Tipos externos
import type { MyType } from '@galeno/shared-types';
```

## Verificación Pre-Commit

Antes de hacer commit de un nuevo archivo de ruta:

```bash
# 1. Verificar TypeScript
npx tsc --noEmit src/routes/v1/my-new-route.ts

# 2. Verificar patrón de router
grep "const router: Router = Router()" src/routes/v1/my-new-route.ts

# 3. Verificar imports
grep "import.*from 'express'" src/routes/v1/my-new-route.ts
```

## Ejemplo Completo

```typescript
import { Router, Response } from 'express';
import { Prisma, Plan } from '@prisma/client';
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import { getPlanConfig } from '../../services/plan/config.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/plan/current:
 *   get:
 *     summary: Get current plan information
 *     security:
 *       - bearerAuth: []
 */
router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const user = await prisma.cuenta.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        maxDoctores: true,
        maxAsistentes: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const planConfig = getPlanConfig(user.plan);

    res.json({
      success: true,
      data: {
        plan: user.plan,
        limits: {
          maxDoctores: user.maxDoctores,
          maxAsistentes: user.maxAsistentes,
          maxAlmacenamientoMB: planConfig.maxAlmacenamientoMB
        }
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching plan information');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

## Referencias

- [Express Router Documentation](https://expressjs.com/en/guide/routing.html)
- [TypeScript Best Practices for Express](https://www.typescriptlang.org/docs/handbook/modules.html)
- Galeno API Style Guide (interno)

---

**Fecha de última actualización:** 2026-03-03
**Versión:** 1.0.0
