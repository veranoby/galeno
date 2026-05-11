-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "RolVinculado" AS ENUM ('ASISTENTE', 'ENFERMERA');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM', 'CLINICA_SME');

-- CreateEnum
CREATE TYPE "TipoAntecedente" AS ENUM ('personal', 'familiar', 'medicamento', 'habito', 'alergia');

-- CreateEnum
CREATE TYPE "EstadoConsulta" AS ENUM ('borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('receta', 'examen', 'certificado');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('activo', 'caducado', 'anulado');

-- CreateEnum
CREATE TYPE "TipoCita" AS ENUM ('presencial', 'teleconsulta');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('programada', 'confirmada', 'en_progreso', 'completada', 'cancelada', 'no_presento');

-- CreateEnum
CREATE TYPE "RegistradoPor" AS ENUM ('paciente', 'enfermera', 'doctor');

-- CreateEnum
CREATE TYPE "EstadoConexion" AS ENUM ('activa', 'revocada');

-- CreateEnum
CREATE TYPE "AutorizadoPor" AS ENUM ('paciente', 'representante_legal');

-- CreateEnum
CREATE TYPE "TipoAcceso" AS ENUM ('COMPLETO', 'LIMITADO', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "EstadoArticulo" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "TipoInterconsulta" AS ENUM ('basica', 'derivacion_digital');

-- CreateEnum
CREATE TYPE "EstadoInterconsulta" AS ENUM ('pendiente', 'en_proceso', 'aceptada', 'rechazada', 'completada', 'cerrada');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CUENTA', 'USUARIO_VINCULADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('pendiente', 'completado', 'fallido', 'reembolsado', 'cancelado');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'RESOURCE_ACCESS', 'RESOURCE_CREATE', 'RESOURCE_UPDATE', 'RESOURCE_DELETE', 'PERMISSION_CHANGE', 'ROLE_CHANGE', 'PLAN_CHANGE', 'PAYMENT_ACTION');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PACIENTE', 'CONSULTA', 'DOCUMENTO', 'USUARIO', 'PLAN', 'PAGO');

-- CreateEnum
CREATE TYPE "PlanLimitNotificationType" AS ENUM ('WARNING_NEAR_LIMIT', 'ALERT_AT_LIMIT', 'BLOCK_EXCEED_LIMIT');

-- CreateEnum
CREATE TYPE "ResourceLimitType" AS ENUM ('doctors', 'assistants', 'storage');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('GENERAL', 'CONSENT_REQUEST', 'CONSENT_RESPONSE', 'ACCESS_GRANTED', 'ACCESS_REVOKED');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('recibida', 'autorizada', 'rechazada', 'anulada');

-- CreateEnum
CREATE TYPE "AmbienteFactura" AS ENUM ('pruebas', 'produccion');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'DOCTOR',
    "especialidad" TEXT,
    "ruc" TEXT,
    "sri_validado" BOOLEAN NOT NULL DEFAULT false,
    "senescyt_validado" BOOLEAN NOT NULL DEFAULT false,
    "senescyt_fecha_validacion" TIMESTAMP(3),
    "senescyt_respuesta" JSONB,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "max_doctores" INTEGER NOT NULL DEFAULT 1,
    "max_asistentes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "customer_id" TEXT,
    "estado_pago" TEXT,
    "fecha_fin_suscripcion" TIMESTAMP(3),
    "fecha_inicio_suscripcion" TIMESTAMP(3),
    "metodo_pago_id" TEXT,
    "subscription_id" TEXT,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLimites" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "maxDoctores" INTEGER NOT NULL DEFAULT 1,
    "maxAsistentes" INTEGER NOT NULL DEFAULT 0,
    "maxAlmacenamientoMB" INTEGER NOT NULL DEFAULT 500,
    "tieneInterconsultas" BOOLEAN NOT NULL DEFAULT false,
    "tieneTeleconsultas" BOOLEAN NOT NULL DEFAULT false,
    "tieneHealthWallet" BOOLEAN NOT NULL DEFAULT false,
    "tieneSRIIntegracion" BOOLEAN NOT NULL DEFAULT false,
    "tieneIAAsistente" BOOLEAN NOT NULL DEFAULT false,
    "tieneSoportePrioridad" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanLimites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_vinculados" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "doctor_asignado_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolVinculado" NOT NULL,
    "permisos" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_vinculados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "health_wallet_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "antecedentes_completos" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antecedentes_paciente" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" "TipoAntecedente" NOT NULL,
    "categoria" TEXT,
    "detalle" TEXT NOT NULL,
    "grado" TEXT,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" "RegistradoPor" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antecedentes_paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "asistente_id" TEXT,
    "estado" "EstadoConsulta" NOT NULL,
    "parent_id" TEXT,
    "triaje_data" JSONB,
    "motivo_consulta" TEXT,
    "evolucion" TEXT,
    "diagnostico_cie10" JSONB,
    "receta_json" JSONB,
    "examenes_json" JSONB,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma" TIMESTAMP(3),
    "firma_xml" TEXT,
    "firma_certificado" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "contenido" JSONB NOT NULL,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3),
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'activo',
    "marca_agua" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivo_mime_type" TEXT,
    "archivo_nombre" TEXT,
    "archivo_size" INTEGER,
    "archivo_url" TEXT,
    "hash_sha256" TEXT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_preferencias" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "frecuencia" INTEGER NOT NULL,
    "ultima_aceptacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_preferencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_acceptance_log" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_acceptance_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_brain_analysis" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "analysis_date" TIMESTAMP(3) NOT NULL,
    "patterns" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_brain_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots_disponibilidad" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "ubicacion_id" TEXT,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "duracion_minutos" INTEGER NOT NULL,
    "tipo" "TipoCita" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slots_disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "ubicacion_id" TEXT,
    "slot_id" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoCita" NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'programada',
    "link_video" TEXT,
    "token_acceso" TEXT,
    "notificada_doctor" BOOLEAN NOT NULL DEFAULT false,
    "notificada_paciente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_cancelacion" TEXT,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidades" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_corto" TEXT NOT NULL,
    "herramientas" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_especialidades" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "especialidad_id" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "senescyt_validada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_public_profiles" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "bio" TEXT,
    "experiencia" INTEGER NOT NULL DEFAULT 0,
    "especialidades" TEXT NOT NULL,
    "educacion" JSONB,
    "certificaciones" JSONB,
    "idiomas" TEXT NOT NULL DEFAULT '[]',
    "precio_consulta" DECIMAL(10,2),
    "ubicacion" TEXT,
    "telefono_publico" TEXT,
    "email_publico" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "foto_perfil_url" TEXT,
    "foto_portada_url" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vistas_perfil" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_public_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_ratings" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "consulta_id" TEXT,
    "rating" INTEGER NOT NULL,
    "comentario" TEXT,
    "anonimizado" BOOLEAN NOT NULL DEFAULT false,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "reportado" BOOLEAN NOT NULL DEFAULT false,
    "util" INTEGER NOT NULL DEFAULT 0,
    "noUtil" INTEGER NOT NULL DEFAULT 0,
    "respuesta" TEXT,
    "respuesta_fecha" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_wallets" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexiones_pacientes" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "autorizado_por" "AutorizadoPor" NOT NULL,
    "fecha_autorizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoConexion" NOT NULL DEFAULT 'activa',
    "permisos" JSONB NOT NULL,
    "revocada_en" TIMESTAMP(3),
    "fecha_expiracion" TIMESTAMP(3),
    "tipo_acceso" "TipoAcceso" NOT NULL,

    CONSTRAINT "conexiones_pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articulos" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "resumen" TEXT,
    "estado" "EstadoArticulo" NOT NULL DEFAULT 'pendiente',
    "es_destacado" BOOLEAN NOT NULL DEFAULT false,
    "es_patrocinado" BOOLEAN NOT NULL DEFAULT false,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interconsultas" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "tipo" "TipoInterconsulta" NOT NULL,
    "estado" "EstadoInterconsulta" NOT NULL DEFAULT 'pendiente',
    "mensaje" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_en" TIMESTAMP(3),
    "respuesta" TEXT,

    CONSTRAINT "interconsultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_type" "UserType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_pagos" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "metodo_pago" TEXT NOT NULL,
    "estado" "EstadoPago" NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "factura_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "accion" "AuditAction" NOT NULL,
    "resource_type" "ResourceType",
    "resource_id" TEXT,
    "rol_usuario" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limit_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "notification_type" "PlanLimitNotificationType" NOT NULL,
    "resource_type" "ResourceLimitType" NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "limit_value" DOUBLE PRECISION NOT NULL,
    "percentage_used" DOUBLE PRECISION NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "plan_limit_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "datos" JSONB,
    "tipo" "TipoNotificacion" NOT NULL DEFAULT 'GENERAL',
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "secuencial" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'recibida',
    "monto_total" DECIMAL(10,2) NOT NULL,
    "xml_generado" TEXT,
    "xml_autorizado" TEXT,
    "clave_acceso" TEXT,
    "ambiente" "AmbienteFactura" NOT NULL DEFAULT 'pruebas',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT NOT NULL,
    "external_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_splits" (
    "id" TEXT NOT NULL,
    "pago_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "status" "SplitStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payment_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_logs" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "transaction_id" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_data" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "consulta_id" TEXT,
    "datos" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senescyt_cache" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "numero_titulo" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "senescyt_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_email_key" ON "cuentas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_ruc_key" ON "cuentas"("ruc");

-- CreateIndex
CREATE INDEX "cuentas_email_idx" ON "cuentas"("email");

-- CreateIndex
CREATE INDEX "cuentas_plan_idx" ON "cuentas"("plan");

-- CreateIndex
CREATE INDEX "cuentas_ruc_idx" ON "cuentas"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimites_cuentaId_key" ON "PlanLimites"("cuentaId");

-- CreateIndex
CREATE INDEX "PlanLimites_cuentaId_idx" ON "PlanLimites"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_vinculados_email_key" ON "usuarios_vinculados"("email");

-- CreateIndex
CREATE INDEX "usuarios_vinculados_cuenta_id_idx" ON "usuarios_vinculados"("cuenta_id");

-- CreateIndex
CREATE INDEX "usuarios_vinculados_doctor_asignado_id_idx" ON "usuarios_vinculados"("doctor_asignado_id");

-- CreateIndex
CREATE INDEX "usuarios_vinculados_email_idx" ON "usuarios_vinculados"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_health_wallet_id_key" ON "pacientes"("health_wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cedula_key" ON "pacientes"("cedula");

-- CreateIndex
CREATE INDEX "pacientes_cuenta_id_idx" ON "pacientes"("cuenta_id");

-- CreateIndex
CREATE INDEX "pacientes_cedula_idx" ON "pacientes"("cedula");

-- CreateIndex
CREATE INDEX "pacientes_health_wallet_id_idx" ON "pacientes"("health_wallet_id");

-- CreateIndex
CREATE INDEX "pacientes_nombre_idx" ON "pacientes"("nombre");

-- CreateIndex
CREATE INDEX "antecedentes_paciente_paciente_id_idx" ON "antecedentes_paciente"("paciente_id");

-- CreateIndex
CREATE INDEX "antecedentes_paciente_tipo_idx" ON "antecedentes_paciente"("tipo");

-- CreateIndex
CREATE INDEX "consultas_cuenta_id_idx" ON "consultas"("cuenta_id");

-- CreateIndex
CREATE INDEX "consultas_paciente_id_idx" ON "consultas"("paciente_id");

-- CreateIndex
CREATE INDEX "consultas_doctor_id_idx" ON "consultas"("doctor_id");

-- CreateIndex
CREATE INDEX "consultas_estado_idx" ON "consultas"("estado");

-- CreateIndex
CREATE INDEX "consultas_created_at_idx" ON "consultas"("created_at");

-- CreateIndex
CREATE INDEX "consultas_parent_id_idx" ON "consultas"("parent_id");

-- CreateIndex
CREATE INDEX "documentos_consulta_id_idx" ON "documentos"("consulta_id");

-- CreateIndex
CREATE INDEX "documentos_paciente_id_idx" ON "documentos"("paciente_id");

-- CreateIndex
CREATE INDEX "documentos_tipo_idx" ON "documentos"("tipo");

-- CreateIndex
CREATE INDEX "documentos_estado_idx" ON "documentos"("estado");

-- CreateIndex
CREATE INDEX "documentos_fecha_expiracion_idx" ON "documentos"("fecha_expiracion");

-- CreateIndex
CREATE INDEX "ia_preferencias_doctor_id_idx" ON "ia_preferencias"("doctor_id");

-- CreateIndex
CREATE INDEX "ia_preferencias_categoria_idx" ON "ia_preferencias"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "ia_preferencias_doctor_id_categoria_item_id_key" ON "ia_preferencias"("doctor_id", "categoria", "item_id");

-- CreateIndex
CREATE INDEX "ia_acceptance_log_doctor_id_idx" ON "ia_acceptance_log"("doctor_id");

-- CreateIndex
CREATE INDEX "ia_acceptance_log_category_idx" ON "ia_acceptance_log"("category");

-- CreateIndex
CREATE INDEX "ia_acceptance_log_created_at_idx" ON "ia_acceptance_log"("created_at");

-- CreateIndex
CREATE INDEX "ia_brain_analysis_doctor_id_idx" ON "ia_brain_analysis"("doctor_id");

-- CreateIndex
CREATE INDEX "ia_brain_analysis_analysis_date_idx" ON "ia_brain_analysis"("analysis_date");

-- CreateIndex
CREATE INDEX "ubicaciones_doctor_id_idx" ON "ubicaciones"("doctor_id");

-- CreateIndex
CREATE INDEX "slots_disponibilidad_doctor_id_idx" ON "slots_disponibilidad"("doctor_id");

-- CreateIndex
CREATE INDEX "slots_disponibilidad_ubicacion_id_idx" ON "slots_disponibilidad"("ubicacion_id");

-- CreateIndex
CREATE INDEX "citas_doctor_id_idx" ON "citas"("doctor_id");

-- CreateIndex
CREATE INDEX "citas_paciente_id_idx" ON "citas"("paciente_id");

-- CreateIndex
CREATE INDEX "citas_fecha_hora_idx" ON "citas"("fecha_hora");

-- CreateIndex
CREATE INDEX "citas_estado_idx" ON "citas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_nombre_key" ON "especialidades"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_nombre_corto_key" ON "especialidades"("nombre_corto");

-- CreateIndex
CREATE INDEX "especialidades_nombre_idx" ON "especialidades"("nombre");

-- CreateIndex
CREATE INDEX "doctor_especialidades_doctor_id_idx" ON "doctor_especialidades"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_especialidades_especialidad_id_idx" ON "doctor_especialidades"("especialidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_public_profiles_doctor_id_key" ON "doctor_public_profiles"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_public_profiles_doctor_id_idx" ON "doctor_public_profiles"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_public_profiles_verificado_idx" ON "doctor_public_profiles"("verificado");

-- CreateIndex
CREATE INDEX "doctor_public_profiles_destacado_idx" ON "doctor_public_profiles"("destacado");

-- CreateIndex
CREATE INDEX "doctor_public_profiles_activo_idx" ON "doctor_public_profiles"("activo");

-- CreateIndex
CREATE INDEX "doctor_ratings_doctor_id_idx" ON "doctor_ratings"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_ratings_paciente_id_idx" ON "doctor_ratings"("paciente_id");

-- CreateIndex
CREATE INDEX "doctor_ratings_consulta_id_idx" ON "doctor_ratings"("consulta_id");

-- CreateIndex
CREATE INDEX "doctor_ratings_aprobado_idx" ON "doctor_ratings"("aprobado");

-- CreateIndex
CREATE INDEX "doctor_ratings_rating_idx" ON "doctor_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "health_wallets_paciente_id_key" ON "health_wallets"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_wallets_walletId_key" ON "health_wallets"("walletId");

-- CreateIndex
CREATE INDEX "health_wallets_walletId_idx" ON "health_wallets"("walletId");

-- CreateIndex
CREATE INDEX "conexiones_pacientes_paciente_id_idx" ON "conexiones_pacientes"("paciente_id");

-- CreateIndex
CREATE INDEX "conexiones_pacientes_doctor_id_idx" ON "conexiones_pacientes"("doctor_id");

-- CreateIndex
CREATE INDEX "conexiones_pacientes_estado_idx" ON "conexiones_pacientes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "conexiones_pacientes_paciente_id_doctor_id_key" ON "conexiones_pacientes"("paciente_id", "doctor_id");

-- CreateIndex
CREATE INDEX "articulos_doctor_id_idx" ON "articulos"("doctor_id");

-- CreateIndex
CREATE INDEX "articulos_estado_idx" ON "articulos"("estado");

-- CreateIndex
CREATE INDEX "articulos_es_destacado_idx" ON "articulos"("es_destacado");

-- CreateIndex
CREATE INDEX "interconsultas_consulta_id_idx" ON "interconsultas"("consulta_id");

-- CreateIndex
CREATE INDEX "interconsultas_solicitante_idx" ON "interconsultas"("solicitante");

-- CreateIndex
CREATE INDEX "interconsultas_destino_idx" ON "interconsultas"("destino");

-- CreateIndex
CREATE INDEX "interconsultas_estado_idx" ON "interconsultas"("estado");

-- CreateIndex
CREATE INDEX "interconsultas_creado_en_idx" ON "interconsultas"("creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "historial_pagos_transaction_id_key" ON "historial_pagos"("transaction_id");

-- CreateIndex
CREATE INDEX "historial_pagos_cuenta_id_idx" ON "historial_pagos"("cuenta_id");

-- CreateIndex
CREATE INDEX "historial_pagos_plan_idx" ON "historial_pagos"("plan");

-- CreateIndex
CREATE INDEX "historial_pagos_estado_idx" ON "historial_pagos"("estado");

-- CreateIndex
CREATE INDEX "historial_pagos_fecha_pago_idx" ON "historial_pagos"("fecha_pago");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_accion_idx" ON "audit_logs"("accion");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "plan_limit_notifications_user_id_idx" ON "plan_limit_notifications"("user_id");

-- CreateIndex
CREATE INDEX "plan_limit_notifications_account_id_idx" ON "plan_limit_notifications"("account_id");

-- CreateIndex
CREATE INDEX "plan_limit_notifications_resource_type_idx" ON "plan_limit_notifications"("resource_type");

-- CreateIndex
CREATE INDEX "plan_limit_notifications_acknowledged_idx" ON "plan_limit_notifications"("acknowledged");

-- CreateIndex
CREATE INDEX "plan_limit_notifications_created_at_idx" ON "plan_limit_notifications"("created_at");

-- CreateIndex
CREATE INDEX "notificaciones_user_id_idx" ON "notificaciones"("user_id");

-- CreateIndex
CREATE INDEX "notificaciones_leido_idx" ON "notificaciones"("leido");

-- CreateIndex
CREATE INDEX "notificaciones_created_at_idx" ON "notificaciones"("created_at");

-- CreateIndex
CREATE INDEX "facturas_cuenta_id_idx" ON "facturas"("cuenta_id");

-- CreateIndex
CREATE INDEX "facturas_ruc_idx" ON "facturas"("ruc");

-- CreateIndex
CREATE INDEX "facturas_secuencial_idx" ON "facturas"("secuencial");

-- CreateIndex
CREATE INDEX "facturas_estado_idx" ON "facturas"("estado");

-- CreateIndex
CREATE INDEX "facturas_fecha_emision_idx" ON "facturas"("fecha_emision");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_transaction_id_key" ON "pagos"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_external_id_key" ON "pagos"("external_id");

-- CreateIndex
CREATE INDEX "pagos_cuenta_id_idx" ON "pagos"("cuenta_id");

-- CreateIndex
CREATE INDEX "pagos_gateway_idx" ON "pagos"("gateway");

-- CreateIndex
CREATE INDEX "pagos_status_idx" ON "pagos"("status");

-- CreateIndex
CREATE INDEX "pagos_transaction_id_idx" ON "pagos"("transaction_id");

-- CreateIndex
CREATE INDEX "pagos_created_at_idx" ON "pagos"("created_at");

-- CreateIndex
CREATE INDEX "payment_splits_pago_id_idx" ON "payment_splits"("pago_id");

-- CreateIndex
CREATE INDEX "payment_splits_recipient_id_idx" ON "payment_splits"("recipient_id");

-- CreateIndex
CREATE INDEX "payment_splits_status_idx" ON "payment_splits"("status");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_gateway_idx" ON "payment_webhook_logs"("gateway");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_event_idx" ON "payment_webhook_logs"("event");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_transaction_id_idx" ON "payment_webhook_logs"("transaction_id");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_created_at_idx" ON "payment_webhook_logs"("created_at");

-- CreateIndex
CREATE INDEX "module_data_module_id_idx" ON "module_data"("module_id");

-- CreateIndex
CREATE INDEX "module_data_paciente_id_idx" ON "module_data"("paciente_id");

-- CreateIndex
CREATE INDEX "module_data_consulta_id_idx" ON "module_data"("consulta_id");

-- CreateIndex
CREATE INDEX "senescyt_cache_expires_at_idx" ON "senescyt_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "senescyt_cache_cedula_numeroTitulo" ON "senescyt_cache"("cedula", "numero_titulo");

-- AddForeignKey
ALTER TABLE "PlanLimites" ADD CONSTRAINT "PlanLimites_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_vinculados" ADD CONSTRAINT "usuarios_vinculados_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_vinculados" ADD CONSTRAINT "usuarios_vinculados_doctor_asignado_id_fkey" FOREIGN KEY ("doctor_asignado_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes_paciente" ADD CONSTRAINT "antecedentes_paciente_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_asistente_id_fkey" FOREIGN KEY ("asistente_id") REFERENCES "usuarios_vinculados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_preferencias" ADD CONSTRAINT "ia_preferencias_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_acceptance_log" ADD CONSTRAINT "ia_acceptance_log_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_brain_analysis" ADD CONSTRAINT "ia_brain_analysis_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots_disponibilidad" ADD CONSTRAINT "slots_disponibilidad_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots_disponibilidad" ADD CONSTRAINT "slots_disponibilidad_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots_disponibilidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_especialidades" ADD CONSTRAINT "doctor_especialidades_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_especialidades" ADD CONSTRAINT "doctor_especialidades_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_public_profiles" ADD CONSTRAINT "doctor_public_profiles_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_ratings" ADD CONSTRAINT "doctor_ratings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_public_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_wallets" ADD CONSTRAINT "health_wallets_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexiones_pacientes" ADD CONSTRAINT "conexiones_pacientes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexiones_pacientes" ADD CONSTRAINT "conexiones_pacientes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_destino_fkey" FOREIGN KEY ("destino") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_solicitante_fkey" FOREIGN KEY ("solicitante") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_pagos" ADD CONSTRAINT "historial_pagos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_limit_notifications" ADD CONSTRAINT "plan_limit_notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_limit_notifications" ADD CONSTRAINT "plan_limit_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_data" ADD CONSTRAINT "module_data_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_data" ADD CONSTRAINT "module_data_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
