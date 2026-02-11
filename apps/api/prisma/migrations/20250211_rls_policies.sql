-- ============================================================================
-- Row Level Security (RLS) - Galeno
-- ============================================================================
-- Migración para habilitar RLS en PostgreSQL y crear policies por rol
--
-- Roles definidos:
-- - DOCTOR: Solo ve sus propios pacientes, consultas, citas
-- - ENFERMERA: Solo ve pacientes del doctor asignado
-- - ASISTENTE: Solo ve pacientes del doctor asignado
-- - ADMIN: Acceso total (bypass RLS)
--
-- Basado en IMPLEMENTATION_PLAN.md Sección 3.3
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURACIÓN DE RLS
-- ============================================================================

-- Función para obtener el user_id del JWT en contexto
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Extraer user_id desde variable de sesión (set por middleware)
  user_id := NULLIF(current_setting('request.jwt.claim.user_id', true), '')::UUID;

  -- Si no existe, intentar desde header (para desarrollo)
  IF user_id IS NULL THEN
    user_id := NULLIF(current_setting('request.user.id', true), '')::UUID;
  END IF;

  RETURN user_id;
END;
$$;

-- Función para obtener el rol del usuario
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim JSONB;
BEGIN
  claim := NULLIF(current_setting('request.jwt.claim', true), '')::JSONB;

  IF claim IS NULL THEN
    claim := '{}'::JSONB;
  END IF;

  RETURN claim;
END;
$$;

-- Función para verificar si es admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "cuentas"
    WHERE id = auth.uid()
    AND rol = 'ADMIN'
  );
END;
$$;

-- ============================================================================
-- 2. HABILITAR RLS EN TABLAS PRINCIPALES
-- ============================================================================

-- Tablas que requieren RLS
ALTER TABLE "cuentas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pacientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consultas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "citas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_vinculados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ubicaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "slots_disponibilidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "antecedentes_paciente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ia_preferencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conexiones_pacientes" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES - CUENTAS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_cuentas" ON "cuentas"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Solo su propia cuenta
CREATE POLICY "doctors_own_account" ON "cuentas"
  FOR ALL
  TO public
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- 4. RLS POLICIES - USUARIOS VINCULADOS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_usuarios_vinculados" ON "usuarios_vinculados"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus usuarios vinculados
CREATE POLICY "doctores_usuarios_vinculados" ON "usuarios_vinculados"
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM "cuentas"
      WHERE id = "usuarios_vinculados"."cuentaId"
      AND id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "cuentas"
      WHERE id = "usuarios_vinculados"."cuentaId"
      AND id = auth.uid()
    )
  );

-- Usuarios vinculados: Su propio registro
CREATE POLICY "usuarios_vinculados_own" ON "usuarios_vinculados"
  FOR SELECT
  TO public
  USING (id = auth.uid());

-- ============================================================================
-- 5. RLS POLICIES - PACIENTES
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_pacientes" ON "pacientes"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus pacientes
CREATE POLICY "doctores_own_pacientes" ON "pacientes"
  FOR ALL
  TO public
  USING ("cuentaId" = auth.uid())
  WITH CHECK ("cuentaId" = auth.uid());

-- Asistentes/Enfermeras: Pacientes del doctor asignado
CREATE POLICY "asistentes_pacientes_asignados" ON "pacientes"
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM "usuarios_vinculados"
      WHERE "usuarios_vinculados"."doctorAsignadoId" = "pacientes"."cuentaId"
      AND "usuarios_vinculados".id = auth.uid()
      AND "usuarios_vinculados".activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "usuarios_vinculados"
      WHERE "usuarios_vinculados"."doctorAsignadoId" = "pacientes"."cuentaId"
      AND "usuarios_vinculados".id = auth.uid()
      AND "usuarios_vinculados".activo = true
    )
  );

-- ============================================================================
-- 6. RLS POLICIES - CONSULTAS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_consultas" ON "consultas"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus consultas
CREATE POLICY "doctores_own_consultas" ON "consultas"
  FOR ALL
  TO public
  USING ("doctorId" = auth.uid())
  WITH CHECK ("doctorId" = auth.uid());

-- Asistentes: Consultas donde hicieron triaje
CREATE POLICY "asistentes_consultas_triaje" ON "consultas"
  FOR ALL
  TO public
  USING ("asistenteId" = auth.uid())
  WITH CHECK ("asistenteId" = auth.uid());

-- ============================================================================
-- 7. RLS POLICIES - DOCUMENTOS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_documentos" ON "documentos"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Documentos de sus consultas
CREATE POLICY "doctores_documentos_consultas" ON "documentos"
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM "consultas"
      WHERE "consultas".id = "documentos"."consultaId"
      AND "consultas"."doctorId" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "consultas"
      WHERE "consultas".id = "documentos"."consultaId"
      AND "consultas"."doctorId" = auth.uid()
    )
  );

-- Todos: Documentos de sus pacientes (via pacienteId)
CREATE POLICY "documentos_pacientes_asignados" ON "documentos"
  FOR SELECT
  TO public
  USING (
    -- Si es doctor, el paciente es suyo
    EXISTS (
      SELECT 1 FROM "pacientes"
      WHERE "pacientes".id = "documentos"."pacienteId"
      AND "pacientes"."cuentaId" = auth.uid()
    )
    OR
    -- Si es asistente, el paciente es del doctor asignado
    EXISTS (
      SELECT 1 FROM "pacientes"
      INNER JOIN "usuarios_vinculados"
        ON "usuarios_vinculados"."doctorAsignadoId" = "pacientes"."cuentaId"
      WHERE "pacientes".id = "documentos"."pacienteId"
      AND "usuarios_vinculados".id = auth.uid()
      AND "usuarios_vinculados".activo = true
    )
  );

-- ============================================================================
-- 8. RLS POLICIES - CITAS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_citas" ON "citas"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus citas
CREATE POLICY "doctores_own_citas" ON "citas"
  FOR ALL
  TO public
  USING ("doctorId" = auth.uid())
  WITH CHECK ("doctorId" = auth.uid());

-- Pacientes (a través de su doctor): Solo lectura de sus citas
-- Nota: Esta política se maneja a nivel de aplicación

-- ============================================================================
-- 9. RLS POLICIES - UBICACIONES
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_ubicaciones" ON "ubicaciones"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus ubicaciones
CREATE POLICY "doctores_own_ubicaciones" ON "ubicaciones"
  FOR ALL
  TO public
  USING ("doctorId" = auth.uid())
  WITH CHECK ("doctorId" = auth.uid());

-- ============================================================================
-- 10. RLS POLICIES - SLOTS DE DISPONIBILIDAD
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_slots" ON "slots_disponibilidad"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus slots
CREATE POLICY "doctores_own_slots" ON "slots_disponibilidad"
  FOR ALL
  TO public
  USING ("doctorId" = auth.uid())
  WITH CHECK ("doctorId" = auth.uid());

-- ============================================================================
-- 11. RLS POLICIES - ANTECEDENTES PACIENTE
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_antecedentes" ON "antecedentes_paciente"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Antecedentes de sus pacientes
CREATE POLICY "doctores_antecedentes_pacientes" ON "antecedentes_paciente"
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM "pacientes"
      WHERE "pacientes".id = "antecedentes_paciente"."pacienteId"
      AND "pacientes"."cuentaId" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "pacientes"
      WHERE "pacientes".id = "antecedentes_paciente"."pacienteId"
      AND "pacientes"."cuentaId" = auth.uid()
    )
  );

-- Asistentes: Antecedentes de pacientes asignados
CREATE POLICY "asistentes_antecedentes_pacientes" ON "antecedentes_paciente"
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM "pacientes"
      INNER JOIN "usuarios_vinculados"
        ON "usuarios_vinculados"."doctorAsignadoId" = "pacientes"."cuentaId"
      WHERE "pacientes".id = "antecedentes_paciente"."pacienteId"
      AND "usuarios_vinculados".id = auth.uid()
      AND "usuarios_vinculados".activo = true
    )
  );

-- ============================================================================
-- 12. RLS POLICIES - IA PREFERENCIAS
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_ia_preferencias" ON "ia_preferencias"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Sus propias preferencias
CREATE POLICY "doctores_own_ia_preferencias" ON "ia_preferencias"
  FOR ALL
  TO public
  USING ("doctorId" = auth.uid())
  WITH CHECK ("doctorId" = auth.uid());

-- ============================================================================
-- 13. RLS POLICIES - CONEXIONES PACIENTES
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_conexiones" ON "conexiones_pacientes"
  FOR ALL
  TO public
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Doctors: Conexiones donde son origen o destino
CREATE POLICY "doctores_conexiones" ON "conexiones_pacientes"
  FOR ALL
  TO public
  USING (
    "conexiones_pacientes"."pacienteId" IN (
      SELECT id FROM "pacientes" WHERE "cuentaId" = auth.uid()
    )
  )
  WITH CHECK (
    "conexiones_pacientes"."pacienteId" IN (
      SELECT id FROM "pacientes" WHERE "cuentaId" = auth.uid()
    )
  );

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

-- Nota: Las políticas de RLS requieren que la aplicación establezca
-- el contexto del usuario antes de cada consulta. Esto se hace a través
-- del middleware de autenticación (ver src/middleware/auth.ts).
--
-- El middleware establece:
-- SET LOCAL request.jwt.claim.user_id = '<user_id>';
-- SET LOCAL request.user.id = '<user_id>';
--
-- Para verificar las políticas funcionando:
-- SET LOCAL request.user.id = '<user_id>';
-- SELECT * FROM pacientes;  -- Solo debe retornar pacientes del usuario
