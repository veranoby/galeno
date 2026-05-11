# Plan de Implementación - Galeno (Ecuador-Health 360)
## Documento de Planificación Técnica para Desarrollo

**Versión:** 1.0 | **Fecha:** 2026-02-10 | **Baseline:** PRD v3.3.0

---

## 📋 Índice

1. [Resumen Ejecutivo Técnico](#1-resumen-ejecutivo-técnico)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Optimización PostgreSQL](#3-optimización-postgresql)
4. [Optimización Pinia y Cache](#4-optimización-pinia-y-cache)
5. [Nomenclaturas y Convenciones](#5-nomenclaturas-y-convenciones)
6. [Validación Backlog vs PRD](#6-validación-backlog-vs-prd)
7. [Fases de Implementación](#7-fases-de-implementación)
8. [Instrucciones por Task](#8-instrucciones-por-task)

---

## 1. Resumen Ejecutivo Técnico

### 1.1 Stack Tecnológico Confirmado

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Framework:     Vue 3.4+ (Composition API, <script setup>)     │
│  UI Library:    Vuetify 3.6+ (Material Design 3)               │
│  State:         Pinia 2.2+ con pinia-plugin-persistedstate     │
│  Router:        Vue Router 4.4+                                 │
│  Build:         Vite 6.0+                                       │
│  PWA:           vite-plugin-pwa (workbox)                      │
│  Lang:          TypeScript 5.6+ (strict mode)                   │
├─────────────────────────────────────────────────────────────────┤
│                     BACKEND LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Runtime:       Node.js 22 LTS                                  │
│  Framework:     Express 4.19+ (o Fastify 5+)                   │
│  ORM:           Prisma 6.0+                                     │
│  Validation:    Zod 3.23+                                      │
│  Auth:          JWT (jsonwebtoken + jws)                       │
├─────────────────────────────────────────────────────────────────┤
│                     DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  Database:      PostgreSQL 17 (o Supabase)                     │
│  Cache:         Redis 8+ (StackGeier/Upstash)                  │
│  Storage:       IndexedDB (Dexie.js wrapper)                   │
├─────────────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                              │
├─────────────────────────────────────────────────────────────────┤
│  Hosting FE:    Vercel (Edge Functions)                        │
│  Hosting BE:    Railway/Render (o Supabase Edge)               │
│  CI/CD:         GitHub Actions                                  │
│  Monitoring:    Sentry (errors) + Vercel Analytics            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Monorepo vs Multirepo

**Decisión:** MONOREPO con **Turborepo** (o Nx)

```
galeno/
├── apps/
│   ├── web/                 # Frontend Vue 3
│   ├── api/                 # Backend Node.js
│   └── admin/               # Panel administrativo (opcional)
├── packages/
│   ├── shared-types/        # Tipos TypeScript compartidos
│   ├── ui-components/       # Componentes Vuetify compartidos
│   ├── api-client/          # Cliente API generado
│   └── validations/         # Schemas Zod compartidos
├── package.json
├── turbo.json
└── tsconfig.base.json
```

---

## 2. Estructura del Proyecto

### 2.1 Frontend Structure (Vue 3 + Vuetify 3)

```
apps/web/
├── public/
│   ├── icons/               # PWA icons
│   ├── manifest.webmanifest # PWA manifest
│   └── sw.js                # Service Worker entry
├── src/
│   ├── assets/              # Static assets
│   │   ├── styles/
│   │   │   ├── main.scss    # Global styles
│   │   │   └── variables.scss # Vuetify overrides
│   │   └── locales/         # i18n (es, eventually en)
│   ├── components/          # Vue components
│   │   ├── common/          # Reusable components
│   │   │   ├── AppAppBar.vue
│   │   │   ├── AppNavDrawer.vue
│   │   │   └── ConfirmDialog.vue
│   │   ├── consultation/    # Consultation-specific
│   │   │   ├── ConsultationWorkspace.vue
│   │   │   ├── ContextPanel.vue
│   │   │   └── AIChips.vue
│   │   ├── medical/         # Medical tools
│   │   │   ├── Odontogram.vue
│   │   │   ├── RetinaAtlas.vue
│   │   │   └── GrowthCurves.vue
│   │   ├── documents/       # Document components
│   │   │   ├── PrescriptionViewer.vue
│   │   │   ├── ExamViewer.vue
│   │   │   └── ExpiredBadge.vue
│   │   └── specialty/       # Specialty-specific (dynamic)
│   │       └── [especialidad]/
│   ├── composables/         # Composition API utilities
│   │   ├── useAuth.ts
│   │   ├── useConsultation.ts
│   │   ├── useAI.ts
│   │   ├── useSSE.ts
│   │   ├── useOffline.ts
│   │   └── useGPS.ts
│   ├── stores/             # Pinia stores
│   │   ├── auth.ts
│   │   ├── consultation.ts
│   │   ├── patient.ts
│   │   ├── notification.ts
│   │   └── offline.ts
│   ├── stores/modules/     # Specialty-specific stores
│   │   └── [especialidad]/
│   ├── router/             # Vue Router
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── consultation.ts
│   │   │   ├── patient.ts
│   │   │   └── public.ts
│   │   └── guards/
│   │       ├── auth.ts
│   │       └── subscription.ts
│   ├── services/           # API & external services
│   │   ├── api/
│   │   │   ├── client.ts   # Axios/Fetch wrapper
│   │   │   ├── consultation.ts
│   │   │   ├── patient.ts
│   │   │   └── document.ts
│   │   ├── ai/
│   │   │   └── gemini.ts
│   │   ├── crypto/
│   │   │   └── webcrypto.ts
│   │   ├── sri/
│   │   │   └── sri-client.ts
│   │   ├── sse/
│   │   │   └── sse-client.ts
│   │   └── offline/
│   │       └── indexeddb.ts
│   ├── types/              # TypeScript types
│   │   ├── models/
│   │   │   ├── consultation.ts
│   │   │   ├── patient.ts
│   │   │   └── document.ts
│   │   ├── api/
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   ├── date.ts
│   │   └── debounce.ts
│   ├── constants/          # App constants
│   │   ├── consultation.ts
│   │   ├── document.ts
│   │   └── config.ts
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 2.2 Backend Structure (Node.js + Express)

```
apps/api/
├── src/
│   ├── routes/             # API routes
│   │   ├── index.ts
│   │   ├── auth/
│   │   │   ├── index.ts
│   │   │   ├── register.ts
│   │   │   ├── login.ts
│   │   │   └── refresh.ts
│   │   ├── consultation/
│   │   │   ├── index.ts
│   │   │   ├── crud.ts
│   │   │   └── states.ts
│   │   ├── patient/
│   │   │   ├── index.ts
│   │   │   ├── crud.ts
│   │   │   └── antecedents.ts
│   │   ├── document/
│   │   │   ├── index.ts
│   │   │   ├── prescription.ts
│   │   │   └── validation.ts
│   │   ├── sse/
│   │   │   └── index.ts    # SSE endpoint
│   │   └── webhooks/
│   │       └── index.ts
│   ├── controllers/        # Route controllers
│   │   ├── consultation.ts
│   │   ├── patient.ts
│   │   └── document.ts
│   ├── services/           # Business logic
│   │   ├── consultation.ts
│   │   ├── patient.ts
│   │   ├── ai/
│   │   │   └── gemini.ts
│   │   ├── sri/
│   │   │   └── sri-service.ts
│   │   ├── crypto/
│   │   │   └── signature.ts
│   │   ├── notification/
│   │   │   ├── push.ts
│   │   │   └── sse.ts
│   │   └── cache/
│   │       └── redis.ts
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts
│   │   ├── rbac.ts         # Role-based access control
│   │   ├── validation.ts
│   │   └── error.ts
│   ├── models/             # Prisma client is generated
│   │   └── .prisma/
│   │       └── schema.prisma
│   ├── jobs/               # Cron jobs
│   │   ├── document-expiry.ts
│   │   └── ia-brain-aggregation.ts
│   ├── utils/              # Utility functions
│   │   ├── crypto.ts
│   │   ├── validation.ts
│   │   └── format.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── config/             # App configuration
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   └── index.ts            # App entry point
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # SQL migrations
│   └── seed.ts             # Seed data
├── tests/                  # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 3. Optimización PostgreSQL

### 3.1 Schema Prisma Optimizado

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============= TABLAS PRINCIPALES =============

model Cuenta {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String   @map("password_hash")
  nombre            String
  rol               Rol      @default(DOCTOR)
  especialidad      String?
  ruc               String?  @unique
  sriValidado       Boolean  @default(false) @map("sri_validado")
  senescytValidado  Boolean  @default(false) @map("senescyt_validado")
  plan              Plan     @default(FREE)
  maxDoctores       Int      @default(1) @map("max_doctores")
  maxAsistentes     Int      @default(0) @map("max_asistentes")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  pacientes         Paciente[]
  consultas         Consulta[]
  ubicaciones       Ubicacion[]
  slots             SlotDisponibilidad[]
  citas             Cita[]
  usuariosVinculados UsuarioVinculado[]
  doctorEspecialidades DoctorEspecialidad[]
  iaPreferencias    IaPreferencia[]
  conexionesOrigen  ConexionPaciente[] @relation("ConexionOrigen")
  conexionesDestino ConexionPaciente[] @relation("ConexionDestino")
  articulos         Articulo[]
  consultasSolicitadas Interconsulta[] @relation("Solicitante")
  consultasRecibidas  Interconsulta[] @relation("Destino")

  @@index([email])
  @@index([plan])
  @@index([ruc])
  @@map("cuentas")
}

model UsuarioVinculado {
  id                String   @id @default(uuid())
  cuentaId          String   @map("cuenta_id")
  doctorAsignadoId  String   @map("doctor_asignado_id")
  email             String   @unique
  passwordHash      String   @map("password_hash")
  nombre            String
  rol               RolVinculado
  permisos          Jsonb?
  activo            Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  cuenta            Cuenta   @relation(fields: [cuentaId], references: [id], onDelete: Cascade)
  doctorAsignado    Cuenta   @relation("DoctorAsignado", fields: [doctorAsignadoId], references: [id], onDelete: Cascade)
  triajes           Consulta[]

  @@index([cuentaId])
  @@index([doctorAsignadoId])
  @@index([email])
  @@map("usuarios_vinculados")
}

model Paciente {
  id                    String   @id @default(uuid())
  cuentaId              String   @map("cuenta_id")
  healthWalletId        String   @unique @map("health_wallet_id")
  nombre                String
  cedula                String   @unique
  fechaNacimiento       DateTime @map("fecha_nacimiento")
  telefono              String?
  email                 String?
  antecedentesCompletos Boolean  @default(false) @map("antecedentes_completos")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Relations
  cuenta                Cuenta   @relation(fields: [cuentaId], references: [id], onDelete: Cascade)
  antecedentes          AntecedentePaciente[]
  consultas             Consulta[]
  documentos            Documento[]
  citas                 Cita[]
  conexiones            ConexionPaciente[]

  @@index([cuentaId])
  @@index([cedula])
  @@index([healthWalletId])
  @@index([nombre]) // Full-text search
  @@map("pacientes")
}

model AntecedentePaciente {
  id              String   @id @default(uuid())
  pacienteId      String   @map("paciente_id")
  tipo            TipoAntecedente
  categoria       String?
  detalle         String   @db.Text
  grado           String?
  fechaRegistro   DateTime @default(now()) @map("fecha_registro")
  registradoPor   RegistradoPor @map("registrado_por")
  createdAt       DateTime @default(now()) @map("created_at")

  // Relations
  paciente        Paciente @relation(fields: [pacienteId], references: [id], onDelete: Cascade)

  @@index([pacienteId])
  @@index([tipo])
  @@map("antecedentes_paciente")
}

model Consulta {
  id                  String        @id @default(uuid())
  cuentaId            String        @map("cuenta_id")
  pacienteId          String        @map("paciente_id")
  doctorId            String        @map("doctor_id")
  asistenteId         String?       @map("asistente_id")
  estado              EstadoConsulta
  parentId            String?       @map("parent_id") // Para interconsultas
  triajeData          Jsonb?        @map("triaje_data")
  motivoConsulta      String?       @map("motivo_consulta") @db.Text
  evolucion           String?       @db.Text
  diagnosticoCie10    Jsonb?        @map("diagnostico_cie10")
  recetaJson          Jsonb?        @map("receta_json")
  examenesJson        Jsonb?        @map("examenes_json")
  firmado             Boolean       @default(false)
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  // Relations
  cuenta              Cuenta        @relation(fields: [cuentaId], references: [id], onDelete: Cascade)
  paciente            Paciente      @relation(fields: [pacienteId], references: [id], onDelete: Cascade)
  doctor              Cuenta        @relation("DoctorConsulta", fields: [doctorId], references: [id], onDelete: Cascade)
  asistente           UsuarioVinculado? @relation(fields: [asistenteId], references: [id], onDelete: SetNull)
  documentos          Documento[]
  children            Consulta[]    @relation("Interconsulta")
  parent              Consulta?     @relation("Interconsulta", fields: [parentId], references: [id])
  interconsultasSolicitadas Interconsulta[] @relation("ConsultaOrigen")
  interconsultasRecibidas  Interconsulta[] @relation("ConsultaDestino")

  @@index([cuentaId])
  @@index([pacienteId])
  @@index([doctorId])
  @@index([estado])
  @@index([createdAt]) // Para ordenamiento
  @@index([parentId]) // Para interconsultas
  @@map("consultas")
}

model Documento {
  id              String        @id @default(uuid())
  consultaId      String        @map("consulta_id")
  pacienteId      String        @map("paciente_id")
  tipo            TipoDocumento
  contenido       Jsonb
  firmado         Boolean       @default(false)
  fechaEmision    DateTime      @default(now()) @map("fecha_emision")
  fechaExpiracion DateTime?     @map("fecha_expiracion")
  estado          EstadoDocumento @default(activo)
  marcaAgua       Boolean       @default(false) @map("marca_agua")
  createdAt       DateTime      @default(now()) @map("created_at")

  // Relations
  consulta        Consulta      @relation(fields: [consultaId], references: [id], onDelete: Cascade)
  paciente        Paciente      @relation(fields: [pacienteId], references: [id], onDelete: Cascade)

  @@index([consultaId])
  @@index([pacienteId])
  @@index([tipo])
  @@index([estado])
  @@index([fechaExpiracion]) // Para cron job de caducidad
  @@map("documentos")
}

model IaPreferencia {
  id                String   @id @default(uuid())
  doctorId          String   @map("doctor_id")
  categoria         String
  itemId            String   @map("item_id")
  frecuencia        Int
  ultimaAceptacion  DateTime @map("ultima_aceptacion")

  // Relations
  doctor            Cuenta   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, categoria, itemId])
  @@index([doctorId])
  @@index([categoria])
  @@map("ia_preferencias")
}

model Ubicacion {
  id          String   @id @default(uuid())
  doctorId    String   @map("doctor_id")
  nombre      String
  direccion   String   @db.Text
  latitud     Decimal? @db.Decimal(10, 8)
  longitud    Decimal? @db.Decimal(11, 8)
  telefono    String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  doctor      Cuenta   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  slots       SlotDisponibilidad[]
  citas       Cita[]

  @@index([doctorId])
  @@map("ubicaciones")
}

model SlotDisponibilidad {
  id              String          @id @default(uuid())
  doctorId        String          @map("doctor_id")
  ubicacionId     String?         @map("ubicacion_id") // NULL = teleconsulta
  diaSemana       Int             @map("dia_semana") // 0-6 (Domingo-Sábado)
  horaInicio      String          @map("hora_inicio") // HH:MM
  horaFin         String          @map("hora_fin")
  duracionMinutos Int             @map("duracion_minutos")
  tipo            TipoCita
  activo          Boolean         @default(true)
  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  doctor          Cuenta          @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  ubicacion       Ubicacion?      @relation(fields: [ubicacionId], references: [id], onDelete: Cascade)
  citas           Cita[]

  @@index([doctorId])
  @@index([ubicacionId])
  @@map("slots_disponibilidad")
}

model Cita {
  id              String          @id @default(uuid())
  doctorId        String          @map("doctor_id")
  pacienteId      String          @map("paciente_id")
  ubicacionId     String?         @map("ubicacion_id") // NULL = teleconsulta
  slotId          String?         @map("slot_id")
  fechaHora       DateTime        @map("fecha_hora")
  tipo            TipoCita
  estado          EstadoCita      @default(programada)
  linkVideo       String?         @map("link_video")
  tokenAcceso     String?         @map("token_acceso")
  notificadaDoctor Boolean        @default(false) @map("notificada_doctor")
  notificadaPaciente Boolean      @default(false) @map("notificada_paciente")
  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  doctor          Cuenta          @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  paciente        Paciente        @relation(fields: [pacienteId], references: [id], onDelete: Cascade)
  ubicacion       Ubicacion?      @relation(fields: [ubicacionId], references: [id], onDelete: SetNull)
  slot            SlotDisponibilidad? @relation(fields: [slotId], references: [id], onDelete: SetNull)

  @@index([doctorId])
  @@index([pacienteId])
  @@index([fechaHora]) // Para búsquedas de disponibilidad
  @@index([estado])
  @@map("citas")
}

model Especialidad {
  id          String   @id @default(uuid())
  nombre      String   @unique
  nombreCorto String   @unique @map("nombre_corto")
  herramientas Jsonb   // Array de tools
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  doctors     DoctorEspecialidad[]

  @@index([nombre])
  @@map("especialidades")
}

model DoctorEspecialidad {
  id                String   @id @default(uuid())
  doctorId          String   @map("doctor_id")
  especialidadId    String   @map("especialidad_id")
  principal         Boolean  @default(false)
  senescytValidada  Boolean  @default(false) @map("senescyt_validada")
  createdAt         DateTime @default(now()) @map("created_at")

  // Relations
  doctor            Cuenta   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  especialidad      Especialidad @relation(fields: [especialidadId], references: [id], onDelete: Cascade)

  @@index([doctorId])
  @@index([especialidadId])
  @@map("doctor_especialidades")
}

model ConexionPaciente {
  id                  String   @id @default(uuid())
  pacienteId          String   @map("paciente_id")
  doctorId            String   @map("doctor_id")
  autorizadoPor       AutorizadoPor @map("autorizado_por")
  fechaAutorizacion   DateTime @default(now()) @map("fecha_autorizacion")
  estado              EstadoConexion @default(activa)
  permisos            Jsonb
  revocadaEn          DateTime? @map("revocada_en")

  // Relations
  paciente            Paciente @relation(fields: [pacienteId], references: [id], onDelete: Cascade)
  doctorOrigen        Cuenta   @relation("ConexionOrigen", fields: [doctorId], references: [id], onDelete: Cascade)
  doctorDestino       Cuenta   @relation("ConexionDestino", fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([pacienteId, doctorId])
  @@index([pacienteId])
  @@index([doctorId])
  @@index([estado])
  @@map("conexiones_pacientes")
}

model Articulo {
  id              String   @id @default(uuid())
  doctorId        String   @map("doctor_id")
  titulo          String
  contenido       String   @db.Text
  resumen         String?  @db.Text
  estado          EstadoArticulo @default(pendiente)
  esDestacado     Boolean  @default(false) @map("es_destacado")
  esPatrocinado   Boolean  @default(false) @map("es_patrocinado")
  likesCount      Int      @default(0) @map("likes_count")
  createdAt       DateTime @default(now()) @map("created_at")

  // Relations
  doctor          Cuenta   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@index([doctorId])
  @@index([estado])
  @@index([esDestacado])
  @@map("articulos")
}

model Interconsulta {
  id              String          @id @default(uuid())
  consultaId      String          @map("consulta_id")
  solicitante     String          @map("solicitante")
  destino         String          @map("destino")
  tipo            TipoInterconsulta
  estado          EstadoInterconsulta @default(pendiente)
  mensaje         String?         @db.Text
  creadoEn        DateTime        @default(now()) @map("creado_en")

  // Relations
  consultaOrigen  Consulta        @relation("ConsultaOrigen", fields: [consultaId], references: [id], onDelete: Cascade)
  consultaDestino Consulta        @relation("ConsultaDestino", fields: [consultaId], references: [id])
  doctorSolicitante Cuenta        @relation("Solicitante", fields: [solicitante], references: [id], onDelete: Cascade)
  doctorDestino   Cuenta          @relation("Destino", fields: [destino], references: [id], onDelete: Cascade)

  @@index([consultaId])
  @@index([solicitante])
  @@index([destino])
  @@index([estado])
  @@map("interconsultas")
}

// ============= ENUMS =============

enum Rol {
  DOCTOR
  ADMIN
}

enum RolVinculado {
  ASISTENTE
  ENFERMERA
}

enum Plan {
  FREE
  PREMIUM
  CLINICA
  ENTERPRISE
}

enum TipoAntecedente {
  personal
  familiar
  medicamento
  habito
  alergia
}

enum EstadoConsulta {
  borrador
  triaje
  pendiente
  en_atencion
  finalizada
  interconsulta
}

enum TipoDocumento {
  receta
  examen
  certificado
}

enum EstadoDocumento {
  activo
  caducado
  anulado
}

enum TipoCita {
  presencial
  teleconsulta
}

enum EstadoCita {
  programada
  confirmada
  en_progreso
  completada
  cancelada
  no_presento
}

enum RegistradoPor {
  paciente
  enfermera
  doctor
}

enum EstadoConexion {
  activa
  revocada
}

enum AutorizadoPor {
  paciente
  representante_legal
}

enum EstadoArticulo {
  pendiente
  aprobado
  rechazado
}

enum TipoInterconsulta {
  basica
  derivacion_digital
}

enum EstadoInterconsulta {
  pendiente
  aceptada
  rechazada
  completada
}
```

### 3.2 Índices Optimizados

**Índices Compuestos Críticos:**

```sql
-- Para búsquedas de pacientes con filtros
CREATE INDEX idx_pacientes_search ON pacientes(cuentaId, nombre);
CREATE INDEX idx_pacientes_cedula ON pacientes(cedula);

-- Para consultas por estado y fecha
CREATE INDEX idx_consultas_estado_fecha ON consultas(cuentaId, estado, "createdAt" DESC);

-- Para disponibilidad de citas
CREATE INDEX idx_citas_disponibles ON citas(doctorId, "fechaHora", estado)
  WHERE estado IN ('programada', 'confirmada');

-- Para documentos caducados (cron job)
CREATE INDEX idx_documentos_expirar ON documentos(fechaExpiracion, estado)
  WHERE estado = 'activo';

-- Full-text search en pacientes
CREATE INDEX idx_pacientes_fts ON pacientes USING gin(to_tsvector('spanish', nombre));
```

### 3.3 Row Level Security (RLS)

```sql
-- ============= RLS POLICIES =============

-- Enable RLS on all tables
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

-- ============= DOCTOR POLICIES =============

-- Doctors can only see their own account
CREATE POLICY doctors_own_account ON cuentas
  FOR USING
  (auth.uid() = id);

-- Doctors can only see their patients
CREATE POLICY doctors_own_patients ON pacientes
  FOR USING
  (cuentaId = auth.uid());

-- Doctors can only see their consultations
CREATE POLICY doctors_own_consultations ON consultas
  FOR USING
  (doctorId = auth.uid());

-- ============= ENFERMERA/ASISTENTE POLICIES =============

-- Asistentes can see their assigned doctor's patients
CREATE POLICY asistentes_patients ON pacientes
  TO ASISTENTE, ENFERMERA
  FOR USING
  (cuentaId IN (
    SELECT doctorAsignadoId FROM usuarios_vinculados
    WHERE email = auth.jwt()->>'email'
  ));

-- Asistentes can create/update triaje but not evolución
CREATE POLICY asistentes_triaje ON consultas
  TO ASISTENTE, ENFERMERA
  FOR UPDATE
  USING (
    doctorId IN (
      SELECT doctorAsignadoId FROM usuarios_vinculados
      WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    jsonb_object_keys(NEW) = ANY(ARRAY['triajeData', 'estado', 'asistenteId'])
  );
```

### 3.4 Consultas Optimizadas

**Listado de pacientes con paginación:**

```typescript
// services/patient/listPatients.ts
import { PrismaClient } from '@galeno/api/prisma';

const prisma = new PrismaClient();

export async function listPatients(
  doctorId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'nombre' | 'createdAt' | 'ultimaConsulta';
  }
) {
  const { page = 1, limit = 50, search, sortBy = 'nombre' } = options;
  const skip = (page - 1) * limit;

  // Build where clause with search
  const where = {
    cuentaId: doctorId,
    ...(search && {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { cedula: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  // Build orderBy
  const orderBy = {
    [sortBy]: sortBy === 'ultimaConsulta' ? { ultimaConsulta: 'desc' } : 'asc',
  };

  // Execute queries in parallel
  const [patients, total] = await Promise.all([
    prisma.paciente.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        nombre: true,
        cedula: true,
        fechaNacimiento: true,
        telefono: true,
        antecedentesCompletos: true,
        createdAt: true,
        // Include last consultation date
        _count: {
          select: { consultas: true },
        },
      },
    }),
    prisma.paciente.count({ where }),
  ]);

  return {
    patients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

---

## 4. Optimización Pinia y Cache

### 4.1 Pinia Stores con Persistencia

```typescript
// stores/consultation.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { consultationApi } from '@/services/api/consultation';
import type { Consultation, ConsultationStatus } from '@/types/models';

export const useConsultationStore = defineStore('consultation', () => {
  // ============= STATE =============
  const activeConsultation = ref<Consultation | null>(null);
  const consultationHistory = ref<Consultation[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ============= COMPUTED =============
  const hasActiveConsultation = computed(() => !!activeConsultation.value);
  const canFinalize = computed(() =>
    activeConsultation.value?.estado === 'en_atencion' &&
    !!activeConsultation.value?.diagnosticoCie10
  );

  // ============= ACTIONS =============
  async function startConsultation(patientId: string) {
    loading.value = true;
    error.value = null;

    try {
      const result = await consultationApi.create({
        pacienteId: patientId,
        estado: 'pendiente',
      });

      activeConsultation.value = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al crear consulta';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateConsultation(id: string, data: Partial<Consultation>) {
    loading.value = true;
    error.value = null;

    try {
      const result = await consultationApi.update(id, data);

      if (activeConsultation.value?.id === id) {
        activeConsultation.value = result;
      }

      // Update history if present
      const index = consultationHistory.value.findIndex(c => c.id === id);
      if (index !== -1) {
        consultationHistory.value[index] = result;
      }

      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al actualizar';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loadPatientHistory(patientId: string) {
    loading.value = true;
    error.value = null;

    try {
      const history = await consultationApi.list({
        pacienteId,
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      consultationHistory.value = history;
      return history;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar historial';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function clearActiveConsultation() {
    activeConsultation.value = null;
  }

  return {
    // State
    activeConsultation,
    consultationHistory,
    loading,
    error,
    // Computed
    hasActiveConsultation,
    canFinalize,
    // Actions
    startConsultation,
    updateConsultation,
    loadPatientHistory,
    clearActiveConsultation,
  };
});
```

### 4.2 Pinia Persist Configuration

```typescript
// stores/index.ts
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

export default pinia;

// ============= PERSIST CONFIG PER STORE =============

// stores/consultation.ts (modificado)
export const useConsultationStore = defineStore('consultation', () => {
  // ... store logic
}, {
  persist: {
    key: 'galeno-consultation',
    storage: sessionStorage, // No persistir consultas activas
    paths: ['consultationHistory'], // Solo historial
  },
});

// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  // ... store logic
}, {
  persist: {
    key: 'galeno-auth',
    storage: localStorage, // Sí persistir auth
    paths: ['user', 'token', 'refreshToken'],
  },
});

// stores/offline.ts
export const useOfflineStore = defineStore('offline', () => {
  // ... store logic
}, {
  persist: {
    key: 'galeno-offline',
    storage: localStorage, // Sí persistir cache offline
  },
});
```

### 4.3 Cache Strategy con Redis

```typescript
// services/cache/redis.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// ============= HELPER FUNCTIONS =============

export function cacheKey(prefix: string, ...parts: (string | number)[]) {
  return `galeno:${prefix}:${parts.join(':')}`;
}

export async function getCache<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(`galeno:${pattern}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ============= IA BRAIN CACHE =============

export async function getIAPreferences(
  doctorId: string,
  category: string
): Promise<string[] | null> {
  const key = cacheKey('ia', doctorId, category);
  return getCache<string[]>(key);
}

export async function setIAPreferences(
  doctorId: string,
  category: string,
  items: string[],
  ttlSeconds: number = 86400 // 24 hours
): Promise<void> {
  const key = cacheKey('ia', doctorId, category);
  await setCache(key, items, ttlSeconds);
}

export async function recordAIAcceptance(
  doctorId: string,
  category: string,
  itemId: string
): Promise<void> {
  // Update Redis cache immediately
  const current = await getIAPreferences(doctorId, category) || [];
  if (!current.includes(itemId)) {
    await setIAPreferences(doctorId, category, [itemId, ...current].slice(0, 10));

    // Queue DB update (don't await)
    prisma.iaPreferencia.upsert({
      where: {
        doctorId_categoria_itemId: {
          doctorId,
          categoria: category,
          itemId,
        },
      },
      create: {
        doctorId,
        categoria: category,
        itemId,
        frecuencia: 1,
        ultimaAceptacion: new Date(),
      },
      update: {
        frecuencia: { increment: 1 },
        ultimaAceptacion: new Date(),
      },
    }).catch(console.error); // Non-blocking
  }
}

// ============= SSE SESSIONS =============

export async function setSSESession(
  doctorId: string,
  sessionId: string,
  connectionId: string,
  ttlSeconds: number = 3600
): Promise<void> {
  const key = cacheKey('sse', doctorId);
  const data = { sessionId, connectionId, timestamp: Date.now() };
  await setCache(key, data, ttlSeconds);
}

export async function getSSESession(
  doctorId: string
): Promise<{ sessionId: string; connectionId: string } | null> {
  const key = cacheKey('sse', doctorId);
  return getCache(key);
}

export async function removeSSESession(doctorId: string): Promise<void> {
  const key = cacheKey('sse', doctorId);
  await redis.del(key);
}

// ============= HEALTH WALLET TOKENS =============

export async function setWalletToken(
  pacienteId: string,
  doctorId: string,
  consultaId: string,
  token: string,
  ttlSeconds: number = 3600 // 1 hour
): Promise<void> {
  const key = cacheKey('wallet', 'token', token);
  await setCache(key, { pacienteId, doctorId, consultaId }, ttlSeconds);
}

export async function getWalletToken(
  token: string
): Promise<{ pacienteId: string; doctorId: string; consultaId: string } | null> {
  const key = cacheKey('wallet', 'token', token);
  return getCache(key);
}
```

---

## 5. Nomenclaturas y Convenciones

### 5.1 Convenciones de Código

**TypeScript/JavaScript:**

```typescript
// ============= FILE NAMES =============
// kebab-case for files
consultation-service.ts
patient-api-client.ts
use-consultation.ts
app-header.vue

// ============= VARIABLES =============
// camelCase for variables and functions
const activeConsultation = null;
function startConsultation() {}

// ============= CONSTANTS =============
// SCREAMING_SNAKE_CASE for constants
const MAX_PATIENTS_PER_PAGE = 50;
const API_BASE_URL = 'https://api.galeno.ec';

// ============= TYPES/INTERFACES =============
// PascalCase for types
interface Consultation {}
type ConsultationStatus = 'borrador' | 'triaje' | ...;

// ============= ENUMS =============
// PascalCase for enums
enum EstadoConsulta {
  BORRADOR = 'borrador',
  TRIAJE = 'triaje',
  // ...
}

// ============= CLASSES =============
// PascalCase for classes
class ConsultationService {}
```

**Vue Components:**

```vue
<!-- ============= COMPONENT NAMES ============= -->
<!-- PascalCase for component names -->
<template>
  <ConsultationWorkspace />
  <PatientContextPanel />
  <AIChips />
</template>

<!-- ============= PROPS ============= -->
<script setup lang="ts">
// camelCase for props
interface Props {
  patientId: string;
  readonly?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

// ============= EMITS =============
// kebab-case for emitted events (but camelCase in code)
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'consulta-iniciada': [consulta: Consultation];
}>();
</script>
```

**API Endpoints:**

```typescript
// ============= ROUTE NAMES =============
// kebab-case for route paths
GET    /api/consultations/:id
POST   /api/consultations
PATCH  /api/consultations/:id
DELETE /api/consultations/:id

GET    /api/patients/:id/antecedents
POST   /api/patients/:id/antecedents

GET    /api/doctors/:doctorId/slots
POST   /api/doctors/:doctorId/slots
```

**Database:**

```sql
-- ============= TABLE NAMES =============
-- snake_case for table names
pacientes
consultas
antecedentes_paciente
slots_disponibilidad

-- ============= COLUMN NAMES =============
-- snake_case for column names
fecha_nacimiento
antecedentes_completos
diagnostico_cie10
```

### 5.2 Git Commit Convention

```bash
# ============= COMMIT FORMAT =============
<type>(<scope>): <subject>

<body>

<footer>

# ============= TYPES =============
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Code style changes (formatting, etc.)
refactor: Code refactoring
perf:     Performance improvements
test:     Adding or updating tests
chore:    Maintenance tasks
build:    Build system changes
ci:       CI/CD changes

# ============= EXAMPLES =============
feat(consultation): add IA chips with color coding

Implement AI suggestion chips in three colors:
- Blue: CIE-10 diagnostics (stage 1)
- Green: Medication suggestions (stage 2)
- Yellow: Exam suggestions (stage 2)
- Red: Security alerts (allergies, contradictions)

Closes #123

fix(auth): resolve JWT refresh token race condition

The previous implementation allowed multiple refresh requests
to race, causing duplicate tokens. Added request deduplication.

Fixes #456

perf(database): add composite index for patient search

New index on (cuentaId, nombre) improves search performance
by ~80% for accounts with >1000 patients.
```

---

## 6. Validación Backlog vs PRD

### 6.1 Coverage Matrix

| Feature PRD | Backlog Tasks | Status |
|-------------|---------------|--------|
| **Autenticación y Onboarding** | TASK-003, TASK-004 | ✅ |
| **Firma Electrónica XAdES-BES** | TASK-005 | ✅ |
| **Facturación SRI** | TASK-011, TASK-052 | ✅ |
| **Gestión Consultas Médicas** | TASK-006 | ✅ |
| **Agendamiento Híbrido** | TASK-014, TASK-043, TASK-047C | ✅ |
| **Teleconsulta (Jitsi)** | TASK-014B, TASK-014C, TASK-038, TASK-039, TASK-040, TASK-041 | ✅ |
| **IA Copilot Por Etapas** | TASK-009, TASK-010, TASK-028, TASK-035, TASK-047E | ✅ |
| **Health Wallet** | TASK-008, TASK-045, TASK-047 | ✅ |
| **Antecedentes Paciente** | TASK-027, TASK-034 | ✅ |
| **Interconsultas** | TASK-013, TASK-046 | ✅ |
| **Triaje Médico** | TASK-012 | ✅ |
| **Documentos con Caducidad** | TASK-026, TASK-036, TASK-037 | ✅ |
| **Módulo Especialidad** | TASK-044 | ✅ |
| **Offline-First** | TASK-007 | ✅ |
| **Sistema de Notificaciones** | TASK-029 | ✅ |
| **SSE Server** | TASK-025, TASK-032 | ✅ |
| **Sistema de Planes** | TASK-020 | ✅ |
| **Marketplace Módulos** | TASK-016 | ✅ |
| **Pagos** | TASK-018 | ✅ |
| **WebRTC Pro** | TASK-042 | ✅ |
| **Buscador con Mapa** | TASK-048, TASK-051 | ✅ |
| **Galeno Hub** | TASK-049 | ✅ |
| **Dashboard Doctor** | TASK-047A | ✅ |
| **Dashboard Paciente** | TASK-047 | ✅ |
| **Sistema de Roles** | TASK-047B | ✅ |
| **PWA Multi-Device** | TASK-047D, TASK-050 | ✅ |
| **Testing Suite** | TASK-021 | ✅ |
| **RLS Security** | TASK-017 | ✅ |
| **Cifrado AES-256** | TASK-023 | ✅ |

### 6.2 Gaps Identificados

**No se identificaron gaps.** Todas las funcionalidades del PRD están cubiertas en el backlog.

---

## 7. Fases de Implementación

### 7.1 Roadmap por Fases

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 0: FOUNDATION (Semana 1-2)                                │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-001: Inicializar Proyecto Vue 3                        │
│  ✅ TASK-002: Configurar PostgreSQL + Prisma                    │
│  ✅ TASK-031: Setup Redis                                       │
│  ✅ TASK-017: Row Level Security                                │
│  ✅ TASK-023: Cifrado AES-256                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: AUTH & CORE (Semana 3-5)                               │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-003: Sistema de Autenticación                          │
│  ✅ TASK-004: Onboarding Flow                                   │
│  ✅ TASK-005: Firma Electrónica XAdES-BES                       │
│  ✅ TASK-011: Facturación SRI                                   │
│  ✅ TASK-020: Sistema de Planes                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: CONSULTATION WORKFLOW (Semana 6-9)                     │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-006: Sistema de Consultas                              │
│  ✅ TASK-027: Antecedentes del Paciente                         │
│  ✅ TASK-030: Área de Trabajo con Panel Lateral                  │
│  ✅ TASK-012: Sistema de Triaje                                 │
│  ✅ TASK-047A: Dashboard Doctor                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: IA & INNOVATION (Semana 10-13)                         │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-009: IA Copilot Por Etapas                             │
│  ✅ TASK-010: AI Chips UI                                       │
│  ✅ TASK-028: IA Brain con Redis                                │
│  ✅ TASK-035: Debounce Handler                                  │
│  ✅ TASK-033: Batch Job Aggregation                             │
│  ✅ TASK-047E: Estrategia IA 3 Fases                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 4: AGENDAMIENTO & TELECONSULTA (Semana 14-17)             │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-014: Sistema de Agendamiento                           │
│  ✅ TASK-043: GPS Dinámico Multi-Oficina                        │
│  ✅ TASK-047C: Módulo Agenda                                    │
│  ✅ TASK-014B: Integración Jitsi Meet                           │
│  ✅ TASK-014C: Teleconsulta PiP                                │
│  ✅ TASK-038: Sala de Espera Virtual                            │
│  ✅ TASK-039: Validación Health Wallet                          │
│  ✅ TASK-040: Flujo Completo Teleconsulta                       │
│  ✅ TASK-041: Notificaciones PWA Push + WhatsApp                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 5: HEALTH WALLET & DOCUMENTS (Semana 18-20)               │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-008: Health Wallet del Paciente                        │
│  ✅ TASK-045: Protocolo Compartir LOPDP                         │
│  ✅ TASK-047: Dashboard Paciente                                │
│  ✅ TASK-026: Documentos con Caducidad                          │
│  ✅ TASK-036: Cron Job Caducidad                                │
│  ✅ TASK-037: UI Marca de Agua                                  │
│  ✅ TASK-019: Validación QR Farmacias                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 6: REALTIME & OFFLINE (Semana 21-23)                      │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-025: SSE Server                                        │
│  ✅ TASK-032: Client-Side SSE Handling                          │
│  ✅ TASK-029: Notificaciones Tres-Tipos                         │
│  ✅ TASK-007: Offline-First IndexedDB                           │
│  ✅ TASK-047D: PWA Instalable                                   │
│  ✅ TASK-050: PWA Responsive                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 7: SPECIALTY & INTERCONSULTA (Semana 24-26)                │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-044: Módulo Especialidad Dinámico                      │
│  ✅ TASK-013: Interconsultas con Custodia                       │
│  ✅ TASK-046: Interconsulta Simplificada                        │
│  ✅ TASK-034: Indicador Completitud Antecedentes                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 8: MARKETPLACE & MONETIZATION (Semana 27-29)               │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-016: Marketplace de Módulos                            │
│  ✅ TASK-018: Pasarelas de Pago                                 │
│  ✅ TASK-042: Módulo WebRTC Pro                                 │
│  ✅ TASK-015: Migración Inteligente                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 9: DISCOVERY & COMMUNITY (Semana 30-33)                   │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-048: Buscador con Mapa                                 │
│  ✅ TASK-051: Perfil Público Doctor                             │
│  ✅ TASK-047B: Sistema de Roles                                 │
│  ✅ TASK-049: Galeno Hub (FASE 2)                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FASE 10: TESTING & LAUNCH (Semana 34-36)                       │
├─────────────────────────────────────────────────────────────────┤
│  ✅ TASK-021: Testing Suite (80%+)                              │
│  ✅ TASK-022: Dashboard Administrativo                          │
│  ✅ TASK-024: GPS Dinámico y Geolocalización                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Instrucciones por Task

### 8.1 Template para Instrucciones de Implementación

Cada task debe incluir:

```markdown
## TASK-XXX: [Título]

### 📋 Descripción
[Breve descripción de qué se implementa]

### 🎯 Objetivos
- [ ] Objetivo 1
- [ ] Objetivo 2

### 📁 Archivos a Crear/Modificar

#### Frontend
- `src/components/[modulo]/[Component].vue`
- `src/composables/use[Feature].ts`
- `src/stores/[modulo].ts`

#### Backend
- `src/routes/[modulo]/index.ts`
- `src/services/[feature].ts`
- `prisma/schema.prisma` (si aplica)

### 🔑 Puntos Clave
1. **Punto crítico 1**: Explicación
2. **Punto crítico 2**: Explicación

### ✅ Criterios de Aceptación
- [ ] Criterio 1
- [ ] Criterio 2

### 🧪 Testing
- Unit tests: [sí/no]
- Integration tests: [sí/no]

### 📚 Referencias
- PRD: [sección]
- Docs: [links]

### ⚠️ Notas
- Nota importante sobre implementación
```

### 8.2 Ejemplo: TASK-009 (IA Copilot)

```markdown
## TASK-009: IA Copilot Por Etapas

### 📋 Descripción
Implementar el sistema de IA Copilot que asiste al médico durante las consultas mediante chips de sugerencias en dos etapas.

### 🎯 Objetivos
- [ ] Integrar Gemini 1.5 Flash API
- [ ] Implementar debounce de 3-5 segundos
- [ ] Crear endpoint de diagnóstico (etapa 1)
- [ ] Crear endpoint de tratamiento (etapa 2)
- [ ] Implementar IA Brain con Redis cache

### 📁 Archivos a Crear/Modificar

#### Backend
- `src/services/ai/gemini.ts`
- `src/routes/ai/index.ts`
- `src/services/cache/redis.ts` (modificar)
- `src/jobs/ia-brain-aggregation.ts`

#### Frontend
- `src/composables/useAI.ts`
- `src/services/ai/gemini.ts`
- `src/components/consultation/AIChips.vue`

### 🔑 Puntos Clave

1. **SIEMPRE ACTIVO**: No existe toggle. La IA está siempre presente.

2. **Debounce**: Esperar 3-5 segundos de inactividad en el campo "Evolución" antes de llamar a la IA.

3. **Etapa 1 (Diagnóstico)**:
   - Input: Texto actual del campo evolución
   - Output: Array de códigos CIE-10 con descripciones
   - Formato: `{ code: "J01", description: "Sinusitis aguda", color: "info" }`

4. **Etapa 2 (Tratamiento)**:
   - Input: Diagnóstico seleccionado + texto evolución
   - Output: Chips verdes (medicación), amarillos (exámenes), rojos (alertas)
   - Solo se activa DESPUÉS de seleccionar diagnóstico

5. **IA Brain**:
   - Redis cache con TTL 24h
   - Key pattern: `galeno:ia:{doctorId}:{category}`
   - Batch job cada hora para actualizar preferencias

### ✅ Criterios de Aceptación
- [ ] La IA se activa automáticamente al escribir en evolución
- [ ] Los chips aparecen visualmente diferenciados por color
- [ ] Al hacer clic en un chip, se añade al campo correspondiente
- [ ] Las alertas rojas requieren confirmación explícita
- [ ] El sistema funciona sin IA Brain (nice-to-have)

### 🧪 Testing
- Unit tests: Sí (servicio IA, debounce handler)
- Integration tests: Sí (endpoint IA)
- E2E tests: Sí (flujo completo chips)

### 📚 Referencias
- PRD: Sección 4 (Sistema IA Copilot)
- Gemini API: https://ai.google.dev/gemini-api/docs
- Cost targets: < $0.005 por consulta

### ⚠️ Notas
- NO enviar historial completo del paciente a la IA
- System prompt debe especificar rol médico
- Implementar rate limiting por doctor
```

---

## 9. Next Steps

1. **Revisar este documento** con el equipo técnico
2. **Aprobar roadmap** por fases
3. **Asignar tasks** a desarrolladores
4. **Configurar CI/CD** con calidad automática
5. **Iniciar FASE 0: Foundation**

---

*Este documento es vivo y debe actualizarse según el progreso del proyecto.*

**Versión:** 1.0 | **Fecha:** 2026-02-10 | **Autor:** Sistema UC Plan
