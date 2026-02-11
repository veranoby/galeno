# Análisis de Granularidad del Backlog - Galeno v2.0

**Fecha:** 2026-02-11
**Analista:** Sistema de Análisis de Backlog
**Versión Backlog:** 1.0.0 (52 tasks)
**Baseline:** IMPLEMENTATION_PLAN.md v1.0

---

## Ejecutivo Resumido

El backlog actual presenta **problemas significativos de granularidad** que impedirán un desarrollo eficiente:

- **12 tareas demasiado grandes** (deben dividirse en ~35 subtasks)
- **8 tareas faltantes** críticas del plan de implementación
- **23 dependencias implícitas** no declaradas
- **0 criterios de aceptación** en ninguna task
- **0 estimaciones de esfuerzo** en el backlog actual

**Recomendación:** Reestructurar a ~80 tasks con criterios claros y estimaciones T-shirt.

---

## SECCIÓN 1: ANÁLISIS DE GRANULARIDAD

### 1.1 Tasks CRÍTICAS que deben dividirse (L/XL)

#### **TASK-009: IA Copilot Por Etapas** 🔴 XL → 5 tasks

**Problema:** Contiene múltiples componentes independientes que deben desarrollarse por separado.

**División propuesta:**

```
TASK-009A: Integración Gemini 1.5 Flash API (L)
├── Setup API client con rate limiting
├── System prompt médico
└── Endpoint base de diagnóstico

TASK-009B: Debounce Handler IA (S)
├── Implementar debounce 3-5s
├── Detectar inactividad en campo evolución
└── Trigger de llamada a IA

TASK-009C: IA Endpoint Diagnóstico CIE-10 (M)
├── Procesar texto de evolución
├── Retornar array códigos CIE-10
└── Validar respuestas

TASK-009D: IA Endpoint Tratamiento (M)
├── Chips verdes (medicación)
├── Chips amarillos (exámenes)
└── Chips rojos (alertas)

TASK-009E: IA Brain con Redis (L)
├── Cache de preferencias
├── Registro de aceptaciones
└── Batch aggregation job
```

**Impacto:** Sin división, un XL bloquearía el sprint por 3-4 semanas.

---

#### **TASK-006: Sistema de Consultas** 🔴 XL → 4 tasks

**Problema:** CRUD + 6 estados + transiciones de estado + firmas es demasiado para una task.

**División propuesta:**

```
TASK-006A: CRUD Base Consultas (M)
├── Create/Read/Update consultas
├── Schema Prisma Consulta
└── API endpoints básicos

TASK-006B: Máquina de Estados Consultas (M)
├── Implementar 6 estados
├── Transiciones válidas
└── Validaciones por estado

TASK-006C: Consultas con Firma Electrónica (L)
├── Integración TASK-005
├── Marcar como firmado
└── Prevención de ediciones post-firma

TASK-006D: Historial de Consultas (S)
├── Listado paginado
├── Filtros por estado/fecha
└── Búsqueda Full-text
```

---

#### **TASK-008: Health Wallet del Paciente** 🔴 XL → 4 tasks

**Problema:** Múltiples componentes: wallet, autorización LOPDP, QR, dashboard.

**División propuesta:**

```
TASK-008A: Health Wallet Core (L)
├── Modelo de Health Wallet
├── Generación de wallet ID único
└── Schema Prisma

TASK-008B: Autorización LOPDP Push (M)
├── Flujo de notificación push
├── Consentimiento explícito
└── Registro de autorización

TASK-008C: Validación QR Health Wallet (S)
├── Generación QR
├── Endpoint validación
└── Verificación de vigencia

TASK-008D: Dashboard Paciente (M)
├── Vista de Health Wallet
├── Historial de documentos
└── Conexiones con doctores
```

---

#### **TASK-014: Sistema de Agendamiento** 🔴 L → 3 tasks

**División propuesta:**

```
TASK-014A: Modelo de Disponibilidad (M)
├── Schema SlotDisponibilidad
├── CRUD de slots por doctor
└── Validación de superposición

TASK-014B: Motor de Reservas (M)
├── Buscar slots disponibles
├── Crear cita con validación
└── Prevención de double-booking

TASK-014C: Gestión de Citas (S)
├── CRUD de citas
├── Cancelación/reprogramación
└── Notificaciones
```

---

### 1.2 Tasks GRANDES que deben dividirse (M)

#### **TASK-003: Sistema de Autenticación** 🟡 M → 3 tasks

```
TASK-003A: JWT Auth con Refresh Tokens (M)
TASK-003B: Registro/Login con Validación (S)
TASK-003C: Password Recovery Flow (S)
```

#### **TASK-011: Facturación SRI** 🟡 M → 2 tasks

```
TASK-011A: Generación XML SRI (M)
TASK-011B: Firma y Envío SRI (M)
```

#### **TASK-020: Sistema de Planes** 🟡 M → 3 tasks

```
TASK-020A: Modelo de Planes y Límites (S)
TASK-020B: Validación de Límites por Plan (M)
TASK-020C: Upgrade/Downgrade de Plan (S)
```

#### **TASK-025: SSE Server** 🟡 M → 2 tasks

```
TASK-025A: SSE Endpoint Base (S)
TASK-025B: SSE Manager con Reconexión (M)
```

#### **TASK-027: Antecedentes del Paciente** 🟡 M → 3 tasks

```
TASK-027A: CRUD Antecedentes (M)
TASK-027B: Antecedentes por Tipo (S)
TASK-027C: Importación Masiva Antecedentes (S)
```

#### **TASK-028: IA Brain con Redis** 🟡 M → Ya cubierto en TASK-009E

#### **TASK-030: Área de Trabajo con Panel Lateral** 🟡 M → 2 tasks

```
TASK-030A: Consultation Workspace Layout (M)
TASK-030B: Context Panel Dinámico (S)
```

#### **TASK-044: Módulo Especialidad Dinámico** 🟡 M → 3 tasks

```
TASK-044A: Modelo de Especialidades (S)
TASK-044B: Módulos de Especialidad (Odontograma, etc.) (M)
TASK-044C: Validación Senescyt (S)
```

---

## SECCIÓN 2: TASKS FALTANTES

### 2.1 Tasks Críticas Ausentes del Backlog

#### **INFRA-001: Monorepo Setup con Turborepo** 🔴 CRÍTICO

**Fase:** Foundation
**Por qué falta:** El plan especifica monorepo pero el backlog asume estructura implícita.

**Descripción:**
- Configurar Turborepo para apps/web, apps/api, packages/*
- Setup de shared-types, ui-components, api-client
- Configurar workspace dependencies
- Scripts de build y dev coordinados

**Estimación:** M
**Dependencias:** TASK-001

---

#### **INFRA-002: CI/CD Pipeline con GitHub Actions** 🔴 CRÍTICO

**Fase:** Foundation
**Por qué falta:** Infraestructura necesaria para calidad continua.

**Descripción:**
- Pipeline de test automatizado
- Pipeline de lint y type-check
- Pipeline de build
- Deploy automático a Vercel/Railway
- Quality gates

**Estimación:** M
**Dependencias:** TASK-001, TASK-002

---

#### **TEST-001: Test Suite Base Setup** 🔴 CRÍTICO

**Fase:** Foundation
**Por qué falta:** TASK-021 asume suite de tests pero no hay setup inicial.

**Descripción:**
- Configurar Vitest para unit tests
- Configurar Playwright para E2E tests
- Setup de coverage reporting
- Mock de APIs externas
- Fixtures de datos de prueba

**Estimación:** M
**Dependencias:** TASK-001, TASK-002

---

#### **SEC-001: Rate Limiting por Usuario** 🟡 IMPORTANTE

**Fase:** Foundation
**Por qué falta:** Protección contra abuso de API y IA.

**Descripción:**
- Implementar rate limiting por usuario
- Límites específicos para endpoints de IA
- Redis-backed rate limiting
- Respuestas 429 adecuadas

**Estimación:** S
**Dependencias:** TASK-002, TASK-031

---

#### **API-001: API Versioning y Documentación** 🟡 IMPORTANTE

**Fase:** Foundation
**Por qué falta:** Necesario para compatibilidad futura.

**Descripción:**
- Implementar versioning de API (/v1/*)
- OpenAPI/Swagger documentation
- Generación de tipos desde OpenAPI
- Deprecation warnings

**Estimación:** M
**Dependencias:** TASK-002

---

#### **UI-001: Design System Base** 🟡 IMPORTANTE

**Fase:** Foundation
**Por qué falta:** Consistencia visual crítica.

**Descripción:**
- Variables Vuetify personalizadas
- Componentes base reutilizables
- Tokens de diseño (colores, espaciado)
- Guía de estilos

**Estimación:** M
**Dependencias:** TASK-001

---

#### **LOG-001: Logging y Monitoring** 🟡 IMPORTANTE

**Fase:** Foundation
**Por qué falta:** Observabilidad necesaria.

**Descripción:**
- Setup de Sentry para error tracking
- Logging estructurado (pino)
- Métricas de negocio
- Dashboards de monitoring

**Estimación:** M
**Dependencias:** TASK-001, TASK-002

---

#### **MIG-001: Database Migration Strategy** 🟡 IMPORTANTE

**Fase:** Foundation
**Por qué falta:** Gestión de cambios en schema no está cubierta.

**Descripción:**
- Estrategia de migrations con Prisma
- Scripts de seed para desarrollo
- Strategy para data migrations
- Rollback plans

**Estimación:** S
**Dependencias:** TASK-002

---

### 2.2 Tasks de Negocio Ausentes

#### **BIZ-001: Validación Senescyt** 🟡

Validación de títulos médicos contra API Senescyt (mencionado en schema pero no implementado).

#### **BIZ-002: Sistema de Valoraciones** 🟡

Sistema de rating/reviews para doctores en el buscador (TASK-051 asume esto).

#### **BIZ-003: Historial de Cambios** 🟡

Audit log para cambios en datos sensibles (cumplimiento LOPDP).

---

## SECCIÓN 3: DEPENDENCIAS IMPLÍCITAS

### 3.1 Dependencias Críticas No Declaradas

| Task Original | Dependencia Implícita | Impacto si no se declara |
|--------------|----------------------|--------------------------|
| TASK-005 (Firma) | TASK-001 (WebCrypto requiere Vue setup) | No puede implementarse |
| TASK-007 (IndexedDB) | TASK-001 (Wrapper Dexie en frontend) | Bloqueo |
| TASK-009 (IA) | TASK-031 (Redis requerido) | Falla en runtime |
| TASK-010 (AI Chips) | TASK-009 + TASK-001 | Dependencia transitiva |
| TASK-012 (Triaje) | TASK-047B (Roles enfermera) | No funciona sin roles |
| TASK-013 (Interconsulta) | TASK-006C (Firma) | No puede firmar interconsultas |
| TASK-016 (Marketplace) | TASK-018 (Pagos) + TASK-020 (Planes) | Orden incorrecto |
| TASK-019 (QR Farmacias) | TASK-008C (QR Wallet) | Reutilización de código |
| TASK-022 (Admin Dashboard) | TASK-049 (Galeno Hub) | Orden invertido |
| TASK-029 (Notificaciones) | TASK-047D (PWA) + TASK-032 (SSE Client) | No funcionan |
| TASK-033 (Batch Job) | TASK-028 (IA Brain) + CRON INFRA | Infraestructura faltante |
| TASK-036 (Cron Caducidad) | CRON INFRA | No especificado |
| TASK-038 (Sala Espera) | TASK-014B (Jitsi) | Orden correcto |
| TASK-039 (Validación Wallet) | TASK-008B (Autorización) | LOPDP compliance |
| TASK-040 (Teleconsulta) | TASK-014C (PiP) + TASK-038 | Flujo completo |
| TASK-041 (PWA Push) | TASK-047D (PWA) + WHATSAPP API | Integración faltante |
| TASK-042 (WebRTC Pro) | TASK-014B (Jitsi base) | Es un add-on |
| TASK-043 (GPS Multi) | TASK-024 (GPS base) | Order |
| TASK-045 (Compartir LOPDP) | TASK-008B (Autorización) | Misma funcionalidad |
| TASK-046 (Interconsulta Simple) | TASK-013 (Interconsulta Full) | Simplificación |
| TASK-047 (Dashboard Paciente) | TASK-008 (Wallet) | Orden |
| TASK-047A (Dashboard Doctor) | TASK-006 (Consultas) | Requiere datos |
| TASK-047C (Agenda) | TASK-014 (Agendamiento) | Order |
| TASK-047E (IA 3 Fases) | TASK-009 (IA Copilot) | Duplicate |

### 3.2 Infraestructura Faltante para Dependencias

```
CRON-JOBS-INFRA: No hay task para setup de cron jobs
├── TASK-033 (Batch Job Aggregation)
├── TASK-036 (Cron Job Caducidad)
└── Requiere: Infraestructura de scheduler

STORAGE-INFRA: No hay task para storage de documentos
├── TASK-008 (Health Wallet)
├── TASK-026 (Documentos)
└── Requiere: S3/Supabase Storage

EMAIL-INFRA: No hay task para servicio de email
├── TASK-003 (Password recovery)
├── TASK-004 (Onboarding)
└── Requiere: SES/SendGrid/Resend
```

---

## SECCIÓN 4: RECOMENDACIÓN DE BACKLOG V2.0

### 4.1 Schema Propuesto

```json
{
  "version": "2.0.0",
  "lastModified": "2026-02-11",
  "checksum": "galeno-backlog-v2.0",
  "items": [
    {
      "id": "TASK-XXX",
      "title": "Título de la Task",
      "description": "Descripción detallada",
      "status": "pending",
      "priority": "critical|high|medium|low",
      "fase": "Foundation|Auth & Core|...",
      "dependencies": ["TASK-AAA", "TASK-BBB"],

      // CAMPOS NUEVOS V2.0

      "size": "XS|S|M|L|XL",
      "complexity": "low|medium|high",
      "risk": "low|medium|high",
      "acceptanceCriteria": [
        "Criterio 1 verificable",
        "Criterio 2 verificable"
      ],
      "deliverables": [
        "Archivo 1 a crear",
        "Archivo 2 a modificar"
      ],
      "testing": {
        "unit": true,
        "integration": true,
        "e2e": false
      },
      "definitionOfDone": [
        "Código revisado",
        "Tests pasando",
        "Documentación actualizada"
      ],
      "estimatedHours": 8,
      "assignedTo": null,
      "tags": ["frontend", "backend", "infrastructure"],
      "spikes": [
        "Investigación necesaria 1",
        "Prueba de concepto 2"
      ]
    }
  ]
}
```

### 4.2 Definición de T-Shirt Sizing

```
┌─────────────────────────────────────────────────────────────┐
│ XS (Extra Small) = 1-2 horas                                │
│ • Configuración simple                                      │
│ • Cambio menor en código existente                         │
│ • Sin complejidad técnica                                  │
├─────────────────────────────────────────────────────────────┤
│ S (Small) = 3-5 horas (1/2 día)                            │
│ • Feature pequeña bien definida                            │
│ • 1-2 archivos nuevos                                      │
│ • Complejidad baja                                         │
├─────────────────────────────────────────────────────────────┤
│ M (Medium) = 6-12 horas (1-2 días)                         │
│ • Feature moderada                                         │
│ • 3-5 archivos nuevos                                      │
│ • Alguna complejidad (integración API, state management)  │
├─────────────────────────────────────────────────────────────┤
│ L (Large) = 13-20 horas (3-5 días)                         │
│ • Feature compleja                                         │
│ • 6-10 archivos nuevos                                     │
│ • Complejidad alta (IA, crypto, WebRTC)                   │
│ • Requiere investigación                                   │
├─────────────────────────────────────────────────────────────┤
│ XL (Extra Large) = 21-40 horas (1 semana)                  │
│ • Epics que deben dividirse                               │
│ • Múltiples componentes integrados                        │
│ • Alto riesgo técnico                                     │
│ • Debe romperse en M/L                                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Recomendación de Reestructuración

#### De 52 tasks → ~80 tasks

```
FASE 0: FOUNDATION (8 tasks → 14 tasks)
├── INFRA-001: Monorepo Turborepo [M]
├── TASK-001: Vue 3 + Vite Setup [M]
├── TASK-002: PostgreSQL + Prisma [M]
├── TASK-031: Redis Setup [S]
├── MIG-001: Migration Strategy [S]
├── TASK-017: RLS Policies [M]
├── TASK-023: AES-256 Encryption [L]
├── UI-001: Design System Base [M]
├── TEST-001: Test Suite Setup [M]
├── INFRA-002: CI/CD Pipeline [M]
├── SEC-001: Rate Limiting [S]
├── API-001: API Versioning [M]
├── LOG-001: Logging & Monitoring [M]
└── EMAIL-INFRA: Email Service Setup [S]

FASE 1: AUTH & CORE (6 tasks → 12 tasks)
├── TASK-003A: JWT Auth + Refresh [M]
├── TASK-003B: Registro/Login [S]
├── TASK-003C: Password Recovery [S]
├── TASK-004: Onboarding Flow [M]
├── TASK-005: Firma XAdES-BES [L]
├── TASK-011A: XML SRI Generation [M]
├── TASK-011B: SRI Firma y Envío [M]
├── TASK-020A: Planes Model [S]
├── TASK-020B: Validación Límites [M]
├── TASK-020C: Upgrade/Downgrade [S]
├── TASK-052: SRI Integration Complete [M]
└── TASK-047B: Sistema de Roles [M]

FASE 2: CONSULTATION WORKFLOW (5 tasks → 13 tasks)
├── TASK-006A: CRUD Consultas [M]
├── TASK-006B: Máquina Estados [M]
├── TASK-006C: Firma Consultas [L]
├── TASK-006D: Historial Consultas [S]
├── TASK-027A: CRUD Antecedentes [M]
├── TASK-027B: Antecedentes por Tipo [S]
├── TASK-027C: Importación Antecedentes [S]
├── TASK-030A: Consultation Workspace [M]
├── TASK-030B: Context Panel [S]
├── TASK-012: Triaje Colaborativo [M]
├── TASK-034: Completitud Antecedentes [S]
├── TASK-047A: Dashboard Doctor [L]
└── TASK-026: Documentos Caducidad [M]

FASE 3: IA & INNOVATION (5 tasks → 8 tasks)
├── TASK-009A: Gemini API Integration [L]
├── TASK-009B: Debounce Handler [S]
├── TASK-009C: IA Diagnóstico CIE-10 [M]
├── TASK-009D: IA Tratamiento [M]
├── TASK-009E: IA Brain Redis [L]
├── TASK-010: AI Chips UI [M]
├── TASK-035: Debounce Handler [S] ← DUPLICATE
└── TASK-047E: IA 3 Fases Strategy [M]

FASE 4: AGENDAMIENTO & TELECONSULTA (10 tasks → 15 tasks)
├── TASK-014A: Disponibilidad Model [M]
├── TASK-014B: Motor Reservas [M]
├── TASK-014C: Gestión Citas [S]
├── TASK-043: GPS Multi-Oficina [M]
├── TASK-047C: Módulo Agenda [M]
├── TASK-014B (rename): Jitsi Integration [L]
├── TASK-014C (rename): Teleconsulta PiP [L]
├── TASK-038: Sala Espera Virtual [M]
├── TASK-039: Validación Wallet [M]
├── TASK-040: Flujo Teleconsulta [L]
├── TASK-041: PWA Push + WhatsApp [M]
├── TASK-042: WebRTC Pro Add-on [M]
└── TASK-024: GPS Geolocalización [M]

FASE 5: HEALTH WALLET & DOCUMENTS (7 tasks → 10 tasks)
├── TASK-008A: Wallet Core [L]
├── TASK-008B: Autorización LOPDP [M]
├── TASK-008C: Validación QR [S]
├── TASK-008D: Dashboard Paciente [M]
├── TASK-045: Protocolo Compartir [M]
├── TASK-019: QR Farmacias [M]
├── TASK-036: Cron Caducidad [M]
├── TASK-037: UI Marca Agua [S]
├── STORAGE-INFRA: Document Storage [M]
└── TASK-047: Patient Dashboard [M] ← DUPLICATE with TASK-008D

FASE 6: REALTIME & OFFLINE (5 tasks → 7 tasks)
├── TASK-025A: SSE Endpoint [S]
├── TASK-025B: SSE Manager [M]
├── TASK-032: SSE Client [M]
├── TASK-029: Notificaciones 3-Tipos [M]
├── TASK-007: Offline-First IndexedDB [L]
├── TASK-047D: PWA Instalable [M]
└── TASK-050: PWA Responsive [M]

FASE 7: SPECIALTY & INTERCONSULTA (4 tasks → 8 tasks)
├── TASK-044A: Especialidades Model [S]
├── TASK-044B: Módulos Especialidad [L]
├── TASK-044C: Validación Senescyt [S]
├── TASK-013: Interconsultas Full [L]
├── TASK-046: Interconsulta Simple [M]
└── TASK-034: Completitud [S] ← DUPLICATE

FASE 8: MARKETPLACE & MONETIZATION (4 tasks → 6 tasks)
├── TASK-020: Planes ← MOVED TO FASE 1
├── TASK-018: Pasarelas Pago [L]
├── TASK-016: Marketplace [M]
├── TASK-042: WebRTC Pro ← MOVED TO FASE 4
├── TASK-015: Migración Inteligente [L]
└── BIZ-001: Senescyt Validation [S]

FASE 9: DISCOVERY & COMMUNITY (4 tasks → 6 tasks)
├── TASK-024: GPS ← MOVED TO FASE 4
├── TASK-048: Buscador Mapa [L]
├── TASK-051: Perfil Público Doctor [M]
├── TASK-047B: Roles ← MOVED TO FASE 1
├── TASK-049: Galeno Hub [L]
└── BIZ-002: Valoraciones [M]

FASE 10: TESTING & LAUNCH (3 tasks → 5 tasks)
├── TASK-021: Testing Suite [L]
├── TASK-022: Admin Dashboard [M]
├── CRON-INFRA: Cron Jobs Setup [S]
└── TASK-024: GPS ← DUPLICATE
```

### 4.4 Tasks Marcadas para Eliminación

```
TASK-035: Debounce Handler
└── DUPLICATE de TASK-009B

TASK-047E: Estrategia IA 3 Fases
└── OVERLAP con TASK-009C y TASK-009D
└── Debe ser documentación, no task

TASK-033: Batch Job Aggregation
└── Parte de TASK-009E (IA Brain)
└── No es task independiente
```

---

## SECCIÓN 5: ACTION ITEMS INMEDIATOS

### Prioridad 🔴 CRÍTICA (Semana 1)

1. **Dividir TASK-009** en TASK-009A/B/C/D/E
2. **Dividir TASK-006** en TASK-006A/B/C/D
3. **Dividir TASK-008** en TASK-008A/B/C/D
4. **Agregar INFRA-001** (Monorepo)
5. **Agregar INFRA-002** (CI/CD)
6. **Agregar TEST-001** (Test Suite)

### Prioridad 🟡 ALTA (Semana 2)

7. **Agregar criterios de aceptación** a todas las tasks
8. **Agregar estimación T-shirt** a todas las tasks
9. **Agregar SEC-001** (Rate Limiting)
10. **Agregar API-001** (API Versioning)
11. **Agregar LOG-001** (Logging)
12. **Corregir dependencias** en TASK-012, TASK-016, TASK-022

### Prioridad 🟢 MEDIA (Semana 3-4)

13. **Unificar duplicates** (TASK-035, TASK-047E)
14. **Agregar STORAGE-INFRA**
15. **Agregar EMAIL-INFRA**
16. **Agregar CRON-INFRA**
17. **Agregar BIZ-001, BIZ-002, BIZ-003**

---

## CONCLUSIÓN

El backlog v1.0 es un **buen primer paso** pero presenta problemas significativos:

✅ **Bueno:**
- Cobertura completa de features del PRD
- Fases bien definidas
- Prioridades claras

❌ **Problemático:**
- Tasks XL que bloquean sprints
- Falta de infraestructura crítica
- 0 criterios de aceptación
- 0 estimaciones de esfuerzo
- Dependencias no declaradas
- Tasks duplicadas/overlap

📊 **Impacto Numérico:**
- 52 tasks actuales
- ~12 tasks XL deben dividirse en ~35 tasks
- ~8 tasks críticas faltantes
- ~3 tasks duplicadas/overlap
- **Total recomendado: ~85-90 tasks**

🎯 **Próximo Paso:**
Ejecutar reestructuración del backlog siguiendo el schema v2.0 propuesto antes de iniciar el sprint 1.

---

**Documento generado por:** Sistema de Análisis de Backlog v2.0
**Fecha de generación:** 2026-02-11
**Revisión requerida:** Antes de iniciar FASE 0: Foundation
