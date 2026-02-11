# Prisma Migrations - Galeno

> Estrategia de migraciones de base de datos para Ecuador-Health 360

## 📋 Índice

1. [Convenciones](#convenciones)
2. [Tipos de Migraciones](#tipos-de-migraciones)
3. [Workflow de Desarrollo](#workflow-de-desarrollo)
4. [Migraciones en Producción](#migraciones-en-producción)
5. [Data Migrations](#data-migrations)
6. [Rollback Strategy](#rollback-strategy)
7. [Troubleshooting](#troubleshooting)

---

## Convenciones

### Formato de nombre

```
YYYYMMDD_HHMMSS_descriptivo_cambio
```

**Ejemplos:**
- `20250210_143000_init_schema`
- `20250211_091500_add_health_wallet_expiration`
- `20250212_153000_add_sri_integration_fields`

### Orden de ejecución

Las migraciones se ejecutan en orden cronológico. NUNCA modificar archivos de migración existentes.

---

## Tipos de Migraciones

### 1. Schema Migrations

Cambios en la estructura de la base de datos:

```bash
# Crear nueva migración
pnpm run prisma:migrate

# Aplicar migraciones pendientes
pnpm run prisma:migrate
```

**Ejemplos de cambios:**
- Agregar/eliminar tablas
- Agregar/eliminar columnas
- Crear/eliminar índices
- Crear/eliminar relaciones

### 2. Data Migrations

Cambios en los datos existentes (ver [Data Migrations](#data-migrations)):

```bash
# Crear data migration
npx prisma migrate dev --name backfill_health_wallet_ids --create-only
# Editar el SQL generado para incluir INSERT/UPDATE
# Aplicar
pnpm run prisma:migrate
```

### 3. Seed Data

Datos de desarrollo/pruebas:

```bash
# Ejecutar seed
pnpm run prisma:seed

# Reset y re-seed (peligroso en producción)
npx prisma migrate reset
```

---

## Workflow de Desarrollo

### Flujo normal

```bash
# 1. Modificar schema.prisma
# Editar apps/api/prisma/schema.prisma

# 2. Crear migración
pnpm run prisma:migrate
# → Genera: prisma/migrations/TIMESTAMP_name/migration.sql

# 3. Revisar SQL generado
cat prisma/migrations/20250210_143000_init_schema/migration.sql

# 4. Generar Prisma Client
pnpm run prisma:generate

# 5. Probar en desarrollo
# La DB local ya tiene la migración aplicada
```

### Resolver conflictos

Si dos developers crean migraciones en paraleto:

```bash
# 1. Hacer pull de cambios
git pull origin main

# 2. Si hay nueva migración remota, aplicarla localmente
npx prisma migrate dev

# 3. Crear tu migración
pnpm run prisma:migrate

# 4. Push cambios
git push origin main
```

---

## Migraciones en Producción

### Pre-deployment checklist

- [ ] Migración probada en staging
- [ ] Backup de base de datos completado
- [ ] Rollback plan documentado
- [ ] Tiempo estimado de downtime (si aplica)
- [ ] Monitoreo configurado

### Deployment

```bash
# En el servidor (via deploy script)

# 1. Backup automático (scripts/backup-db.sh)
# 2. Aplicar migraciones
npx prisma migrate deploy

# 3. Verificar estado
npx prisma migrate status
```

### Sin downtime (para cambios backwards-compatible)

Para cambios que no rompen compatibilidad:

```bash
# 1. Deploy código nuevo (con schema nuevo)
# 2: Código viejo sigue funcionando con schema viejo
# 2. Aplicar migración
npx prisma migrate deploy
# 3: Código nuevo usa schema nuevo
```

---

## Data Migrations

### Cuándo usar

- Backfill de datos faltantes
- Migración de valores de una columna a otra
- Limpieza de datos inconsistentes
- Agregar valores por defecto a registros existentes

### Estrategia

```sql
-- Ejemplo: Data migration en migration.sql

-- Agregar columna
ALTER TABLE "pacientes" ADD COLUMN "health_wallet_id" TEXT;

-- Backfill datos para registros existentes
UPDATE "pacientes"
SET "health_wallet_id" = 'HW-' || LPAD(encode(decode(substring(cedula, 1, 10), 'base64'), 'hex'), 32, '0')
WHERE "health_wallet_id" IS NULL;

-- Crear índice después del backfill
CREATE UNIQUE INDEX "pacientes_health_wallet_id_key" ON "pacientes"("health_wallet_id");
```

### Data migrations complejas

Para lógica compleja, usar script de Node.js:

```typescript
// scripts/data-migrations/backfill-health-wallet.ts
import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';

const prisma = new PrismaClient();
const limit = pLimit(10); // Procesar 10 registros en paralelo

async function migrate() {
  const pacientes = await prisma.paciente.findMany({
    where: { healthWalletId: null },
    select: { id: true, cedula: true }
  });

  console.log(`Migrando ${pacientes.length} pacientes...`);

  await Promise.all(
    pacientes.map(paciente =>
      limit(async () => {
        const hwId = `HW-${paciente.cedula}-${Date.now()}`;
        await prisma.paciente.update({
          where: { id: paciente.id },
          data: { healthWalletId: hwId }
        });
      })
    )
  );
}

migrate()
  .then(() => console.log('Migración completada'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Rollback Strategy

### Tipos de rollback

#### 1. Reversión manual (DDL reversible)

```sql
-- Guardar el SQL de reversión en un comentario
-- ROLLBACK:
-- ALTER TABLE "pacientes" DROP COLUMN "new_field";
-- DROP INDEX "pacientes_new_field_idx";

ALTER TABLE "pacientes" ADD COLUMN "new_field" TEXT;
CREATE INDEX "pacientes_new_field_idx" ON "pacientes"("new_field");
```

#### 2. Migración de reversión

```bash
# Crear migración que revierte el cambio anterior
npx prisma migrate dev --name revert_add_new_field
```

#### 3. Restore desde backup

```bash
# Último recurso
psql -U galeno_app -d galeno_db < backup_galeno_20250210.sql
```

### Procedimiento de rollback en producción

```bash
# 1: Detener aplicación
pm2 stop galeno-backend

# 2: Evaluar tipo de rollback
# - Si es simple: aplicar SQL de reversión
# - Si es complejo: restore desde backup

# 3: Verificar datos
psql -U galeno_app -d galeno_db -c "SELECT COUNT(*) FROM pacientes;"

# 4: Reiniciar aplicación
pm2 start galeno-backend

# 5: Monitorear logs
pm2 logs galeno-backend --lines 100
```

---

## Troubleshooting

### Error: "Migration failed"

```bash
# Ver estado de migraciones
npx prisma migrate status

# Ver migración fallida
cat prisma/migrations/TIMESTAMP_NAME/migration.sql

# Resolver manualmente si es necesario
psql -U galeno_dev -d galeno_db -f prisma/migrations/TIMESTAMP_NAME/migration.sql

# Marcar como aplicada (solo si se resolvió manualmente)
npx prisma migrate resolve --applied TIMESTAMP_NAME
```

### Error: "Schema drift"

El schema de la DB no coincide con el schema.prisma:

```bash
# Opción 1: Reset (pérdida de datos - solo desarrollo)
npx prisma migrate reset

# Opción 2: Push (crea SQL sin migración - cuidado en producción)
npx prisma db push

# Opción 3: Crear migración desde el diff
npx prisma migrate dev --create-only
# Editar migration.sql manualmente
npx prisma migrate dev
```

### Lock de migración

```sql
-- Liberar lock de migración atascada
DELETE FROM "_prisma_migrations" WHERE "started_at" < NOW() - INTERVAL '1 hour';
```

---

## Best Practices

1. **NUNCA modificar migraciones aplicadas** en producción
2. **Revisar el SQL generado** antes de commitear
3. **Probar en desarrollo** antes de producción
4. **Documentar data migrations** complejas
5. **Backup antes de migración** en producción
6. **Usar transacciones** para data migrations complejas
7. **Monitorear performance** después de migraciones grandes

---

## Referencias

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [CREDENTIALS.md](../../../../../CREDENTIALS.md) - Credenciales de BD
