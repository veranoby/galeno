# Row Level Security (RLS) - Galeno

> Seguridad a nivel de fila para isolation de datos multi-tenant

## 📋 Índice

1. [Overview](#overview)
2. [Arquitectura de Seguridad](#arquitectura-de-seguridad)
3. [Roles y Permisos](#roles-y-permisos)
4. [Implementación](#implementación)
5. [Testing de RLS](#testing-de-rls)
6. [Troubleshooting](#troubleshooting)

---

## Overview

**Row Level Security (RLS)** es una feature de PostgreSQL que permite restringir el acceso a filas específicas basándose en el contexto del usuario. En Galeno, esto garantiza que:

- Cada doctor **solo ve** sus propios pacientes, consultas y citas
- Las enfermeras/asistentes **solo ven** los pacientes del doctor asignado
- Los administradores tienen **acceso completo** para soporte
- No hay filtrado a nivel de aplicación (seguridad enforceada por BD)

---

## Arquitectura de Seguridad

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Frontend)                          │
│                     Bearer Token en Authorization header            │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API (Express Middleware)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  authMiddleware                                           │    │
│  │  1. Valida JWT                                            │    │
│  │  2. Verifica usuario en BD                                │    │
│  │  3. SET LOCAL request.user.id = '<user_id>'              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (RLS Policies)                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  POLICY: doctores_own_pacientes                             │    │
│  │  USING (cuentaId = auth.uid())                             │    │
│  │                                                             │    │
│  │  SELECT * FROM pacientes                                   │    │
│  │  → Solo retorna filas WHERE cuentaId = current_user_id     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Roles y Permisos

### DOCTOR

| Recurso | Permiso |
|---------|---------|
| Su cuenta | ✅ Leer/Actualizar |
| Sus pacientes | ✅ CRUD completo |
| Sus consultas | ✅ CRUD completo |
| Sus documentos | ✅ CRUD completo |
| Sus citas/ubicaciones/slots | ✅ CRUD completo |
| Usuarios vinculados | ✅ CRUD completo |
| Otros doctores | ❌ Sin acceso |

### ASISTENTE / ENFERMERA

| Recurso | Permiso |
|---------|---------|
| Su cuenta | ✅ Solo lectura |
| Pacientes del doctor | ✅ Leer/Actualizar trianje |
| Consultas donde hizo trianje | ✅ Leer/Actualizar trianje |
| Documentos de pacientes asignados | ✅ Solo lectura |
| Otros recursos | ❌ Sin acceso |

### ADMIN

| Recurso | Permiso |
|---------|---------|
| TODO | ✅ Acceso completo (bypass RLS) |

---

## Implementación

### 1. Funciones de Autenticación SQL

```sql
-- Obtener user_id del contexto
auth.uid() RETURNS UUID

-- Obtener claims del JWT
auth.jwt() RETURNS JSONB

-- Verificar si es admin
auth.is_admin() RETURNS BOOLEAN
```

### 2. Middleware de Autenticación

```typescript
// src/middleware/auth.ts

// Establece el contexto RLS antes de cada query
await prisma.$executeRaw`SET LOCAL request.user.id = ${userId}`;

// Todas las queries posteriores respetan RLS
const pacientes = await prisma.paciente.findMany();
// → Solo retorna pacientes del usuario actual
```

### 3. Políticas por Tabla

#### pacientes

```sql
-- Doctors: Solo sus pacientes
CREATE POLICY doctores_own_pacientes ON pacientes
  USING (cuentaId = auth.uid());

-- Asistentes: Pacientes del doctor asignado
CREATE POLICY asistentes_pacientes_asignados ON pacientes
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_vinculados
      WHERE doctorAsignadoId = pacientes.cuentaId
      AND id = auth.uid()
    )
  );
```

#### consultas

```sql
-- Doctors: Solo sus consultas
CREATE POLICY doctores_own_consultas ON consultas
  USING (doctorId = auth.uid());

-- Asistentes: Consultas donde hicieron triaje
CREATE POLICY asistentes_consultas_triaje ON consultas
  USING (asistenteId = auth.uid());
```

---

## Testing de RLS

### Setup de Test

```sql
-- Crear usuarios de prueba
INSERT INTO cuentas (id, email, password_hash, nombre, rol)
VALUES
  ('doctor-1-id', 'doctor1@test.dev', 'hash', 'Dr. 1', 'DOCTOR'),
  ('doctor-2-id', 'doctor2@test.dev', 'hash', 'Dr. 2', 'DOCTOR');

-- Crear pacientes para cada doctor
INSERT INTO pacientes (id, cuenta_id, nombre, cedula, health_wallet_id)
VALUES
  ('paciente-1-id', 'doctor-1-id', 'Paciente 1', '0101', 'HW-1'),
  ('paciente-2-id', 'doctor-2-id', 'Paciente 2', '0102', 'HW-2');
```

### Test 1: Doctor solo ve sus pacientes

```sql
-- Simular login de doctor-1
SET LOCAL request.user.id = 'doctor-1-id';

-- Debe retornar solo paciente-1
SELECT id, nombre FROM pacientes;

-- Resultado esperado:
--  paciente-1-id | Paciente 1
```

### Test 2: Admin ve todo

```sql
-- Simular login de admin
SET LOCAL request.user.id = 'admin-id';

-- Debe retornar ambos pacientes
SELECT id, nombre FROM pacientes;

-- Resultado esperado:
--  paciente-1-id | Paciente 1
--  paciente-2-id | Paciente 2
```

### Test 3: Asistente ve pacientes del doctor

```sql
-- Crear asistente vinculada a doctor-1
INSERT INTO usuarios_vinculados (id, cuenta_id, doctor_asignado_id, email, rol)
VALUES ('asistente-1-id', 'doctor-1-id', 'doctor-1-id', 'enf@test.dev', 'ENFERMERA');

-- Simular login de asistente
SET LOCAL request.user.id = 'asistente-1-id';

-- Debe ver solo pacientes de doctor-1
SELECT id, nombre FROM pacientes;

-- Resultado esperado:
--  paciente-1-id | Paciente 1
```

---

## Troubleshooting

### Problema: RLS no funciona

**Síntoma:** Los usuarios ven datos de otros usuarios.

**Diagnóstico:**
```sql
-- Verificar si RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Debe mostrar rowsecurity = true para tablas principales
```

**Solución:**
```sql
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
```

### Problema: Todas las queries retornan vacío

**Síntoma:** Los usuarios autenticados no ven ningún dato.

**Causa:** El contexto RLS no se está estableciendo.

**Diagnóstico:**
```typescript
// En auth middleware, agregar logging
logger.info('Setting RLS context', { userId: req.user.id });
await prisma.$executeRaw`SET LOCAL request.user.id = ${req.user.id}`;
```

**Solución:** Asegurar que el middleware de auth se ejecuta antes de las queries.

### Problema: Admin no puede ver nada

**Síntoma:** El usuario ADMIN no tiene acceso a datos.

**Causa:** La política de admin usa `auth.is_admin()` que verifica el rol en la BD.

**Diagnóstico:**
```sql
-- Verificar rol del usuario
SELECT id, email, rol FROM cuentas WHERE id = 'admin-id';
-- Debe mostrar rol = 'ADMIN'
```

---

## Best Practices

1. **NUNCA confiar solo en el filtrado de aplicación**
   - RLS es la última línea de defensa
   - Si el código tiene bugs, RLS protege los datos

2. **Usar transactions con SET LOCAL**
   - `SET LOCAL` dura solo la transacción actual
   - Prisma wrapper cada query en una transacción

3. **Testing exhaustivo**
   - Probar cada rol con cada tabla
   - Verificar que usuarios malintencionados no puedan bypass

4. **Auditoría**
   - Loguear accesos no autorizados
   - Monitorear intentos de bypass

---

## Referencias

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma RLS Guide](https://www.prisma.io/docs/guides/database/row-level-security)
- [apps/api/prisma/migrations/20250211_rls_policies.sql](../apps/api/prisma/migrations/20250211_rls_policies.sql)
- [apps/api/src/middleware/auth.ts](../apps/api/src/middleware/auth.ts)

---

**Última actualización:** 2026-02-11
**Versión:** 1.0
