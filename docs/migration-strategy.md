# Database Migration Strategy - Galeno

> Estrategia completa de migraciones para Ecuador-Health 360

## 🎯 Overview

Esta estrategia define cómo manejamos los cambios en el esquema de base de datos a través del ciclo de vida del proyecto, desde desarrollo hasta producción.

---

## 📊 Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|------------|---------|
| ORM | Prisma | 6.0+ |
| Database | PostgreSQL | 17 |
| Migrations | Prisma Migrate | Built-in |
| Seed | Prisma Seed | Custom script |

---

## 🔄 Ciclo de Vida de una Migración

```
┌─────────────────────────────────────────────────────────────────────┐
│                      1. DESARROLLO                                  │
├─────────────────────────────────────────────────────────────────────┤
│  • Developer modifica schema.prisma                                │
│  • Ejecuta: pnpm run prisma:migrate                                │
│  • Prisma genera: migration.sql                                    │
│  • Se aplica automáticamente en desarrollo                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      2. CODE REVIEW                                 │
├─────────────────────────────────────────────────────────────────────┤
│  • Review del migration.sql generado                               │
│  • Verificar: performance, rollback, data loss risks               │
│  • Aprobación para merge                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      3. STAGING (opcional)                          │
├─────────────────────────────────────────────────────────────────────┤
│  • Backup de BD staging                                            │
│  • Aplicar migración                                               │
│  • Ejecutar tests                                                  │
│  • Verificar aplicación funcionando                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      4. PRODUCCIÓN                                   │
├─────────────────────────────────────────────────────────────────────┤
│  • Backup automático (pre-deploy)                                  │
│  • Deploy código nuevo                                             │
│  • npx prisma migrate deploy                                      │
│  • Health checks                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Estrategias de Migración

### 1. Expand-Contract (Zero Downtime)

Para cambios que requieren zero downtime:

```
Fase 1: EXPAND (deploy código + migración)
┌─────────────────────────────────────────┐
│ Schema v1 + Schema v2 coexistiendo     │
│ Código v1 + Código v2 funcionando      │
└─────────────────────────────────────────┘
                    ↓
Fase 2: CONTRACT (remove v1)
┌─────────────────────────────────────────┐
│ Solo Schema v2                          │
│ Solo Código v2                          │
└─────────────────────────────────────────┘
```

**Ejemplo: Renombrar columna**

```sql
-- Migration 1: Agregar nueva columna
ALTER TABLE "pacientes" ADD COLUMN "nombre_completo" TEXT;

-- Data migration: Copiar datos
UPDATE "pacientes" SET "nombre_completo" = "nombre";

-- Deployment: Código usa ambas columnas temporalmente

-- Migration 2: Eliminar vieja columna (después de verificar)
ALTER TABLE "pacientes" DROP COLUMN "nombre";
```

### 2. Blue-Green Deployment

```
         ┌──────────────────┐
         │   Load Balancer  │
         └────────┬─────────┘
                  │
         ┌────────┴────────┐
         │   Switch        │
         └───────┬─────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼─────┐         ┌────▼─────┐
│  Blue     │         │  Green   │
│  v1       │         │  v2      │
│  (live)   │         │  (idle)  │
└───────────┘         └──────────┘
```

1. Deploy v2 en Green (sin tráfico)
2. Aplicar migraciones en Green
3. Verificar Green funciona
4. Switch tráfico → Green
5. Blue queda como backup rápido

### 3. Rolling Migration

Para múltiples instancias:

```
Instance 1: [v1] → [v1] → [v2] → [v2]
Instance 2: [v1] → [v1] → [v1] → [v2]
Instance 3: [v1] → [v1] → [v2] → [v2]
           ↑        ↑        ↑
      Gradual rollout
```

---

## 📝 Tipos de Cambios y Estrategia

| Tipo de Cambio | Estrategia | Downtime | Riesgo |
|----------------|------------|----------|--------|
| Agregar tabla | Directo | 0s | Bajo |
| Agregar columna nullable | Directo | 0s | Bajo |
| Agregar columna con default | Directo | 0s | Medio |
| Agregar índice | CONCURRENTLY | 0s | Medio |
| Eliminar columna | Expand-Contract | Variable | Alto |
| Renombrar columna | Expand-Contract | Variable | Alto |
| Cambiar tipo de dato | Expand-Contract | Variable | Alto |
| Data migration (>100K rows) | Batch + Throttle | Variable | Alto |

---

## ⚡ Performance Considerations

### Índices en producción

```sql
-- Usar CONCURRENTLY para evitar locks largos
CREATE INDEX CONCURRENTLY "pacientes_nombre_idx" ON "pacientes"("nombre");

-- No usar CONCURRENTLY en una transacción
-- Eliminar primero si existe al re-hacer
DROP INDEX IF EXISTS "pacientes_nombre_idx";
CREATE INDEX CONCURRENTLY "pacientes_nombre_idx" ON "pacientes"("nombre");
```

### Data migrations grandes

```typescript
// Procesar en batches de 1000 registros
const BATCH_SIZE = 1000;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const batch = await prisma.paciente.findMany({
    take: BATCH_SIZE,
    skip: offset,
    where: { healthWalletId: null }
  });

  if (batch.length === 0) {
    hasMore = false;
  } else {
    await Promise.all(
      batch.map(p => processPaciente(p))
    );
    offset += BATCH_SIZE;
    console.log(`Procesados ${offset} registros...`);
  }
}
```

---

## 🔄 Rollback Procedures

### Nivel 1: Revertir código (sin tocar DB)

```bash
# La migración es backwards-compatible
# El código viejo funciona con el schema nuevo
git revert HEAD
pm2 reload galeno-backend
```

### Nivel 2: Revertir migración

```sql
-- SQL de reversión preparado
ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "new_column";
DROP INDEX IF EXISTS "pacientes_new_column_idx";
```

### Nivel 3: Restore desde backup

```bash
# En el servidor
cd /var/backups/galeno
pg_dump -U galeno_app -d galeno_db > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Si falla: restore
psql -U galeno_app -d galeno_db < backup_pre_migration_20250210_143000.sql
```

---

## 📋 Checklist Pre-Deploy

- [ ] Migración probada en local
- [ ] SQL generado revisado
- [ ] Data migration probada (si aplica)
- [ ] Rollback SQL preparado
- [ ] Backup de producción agendado
- [ ] Tiempo estimado documentado
- [ ] Monitoreo configurado
- [ ] Comunicación a stakeholders (si downtime > 5min)

---

## 🔐 Seguridad

### Row Level Security (RLS)

Las migraciones deben respetar RLS:

```sql
-- Verificar políticas después de crear tabla
ALTER TABLE "pacientes" ENABLE ROW LEVEL SECURITY;

-- Política se crea en migración separada
-- Ver TASK-017 para detalles
```

### Datos sensibles

```sql
-- Columnas sensibles usan cifrado
-- Ver TASK-023 para detalles de AES-256

ALTER TABLE "pacientes" ADD COLUMN "datos_confidenciales" TEXT;
-- Los datos se cifran a nivel de aplicación antes de INSERT
```

---

## 📖 Referencias

- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [apps/api/prisma/migrations/README.md](../apps/api/prisma/migrations/README.md)

---

**Última actualización:** 2026-02-11
**Versión:** 1.0
