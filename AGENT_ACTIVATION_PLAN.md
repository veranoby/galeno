# PLAN DE ACTIVACIÓN DE AGENTES Y SKILLS - IMPLEMENTACIÓN ÓPTIMA

**Fecha:** 2026-02-17
**Basado en:** PLAN_IMPLEMENTACION_V1.md + brain/backlog.json
**Objetivo:** Activar agentes especializados para cada fase con máxima eficiencia

---

## 📊 ANÁLISIS DE TAREAS PENDIENTES DEL PLAN V1

### Tareas a Implementar (Según PLAN_IMPLEMENTACION_V1.md)

| ID | Tarea | Complejidad | Horas Est. | Estado |
|----|-------|-------------|------------|--------|
| TASK-046 | Interconsulta Simplificada | Media | 6h | ⏳ Pendiente |
| TASK-024 | GPS Dinámico y Geolocalización | Media | 8h | ⏳ Pendiente |
| TASK-050 | PWA Responsive | Media | 4h | ⏳ Pendiente |
| TASK-044C | Validación Senescyt | Media | 6h | ⏳ Pendiente |

**Total estimado:** 24 horas

---

## 🤖 MATRIZ DE ACTIVACIÓN DE AGENTES POR FASE

### FASE 1: TASK-046 - Interconsulta Simplificada

#### Agentes Recomendados:

| Agente | Tipo | Activación | Responsabilidad |
|--------|------|------------|-----------------|
| **backend-architect** | Especializado | ✅ OBLIGATORIO | - Diseñar routes de interconsulta<br>- Validar estructura de endpoints<br>- Asegurar patrones REST consistentes |
| **frontend-architect** | Especializado | ✅ OBLIGATORIO | - Crear componente Vue 3 + Vuetify<br>- Implementar UX optimizada<br>- Validar accesibilidad |
| **quality-engineer** | Especializado | ✅ OBLIGATORIO | - Verificar criterios de aceptación<br>- Validar tracking y cierre manual<br>- Testear flujos de estado |

#### Skills Requeridos:
- `context7` (MCP): Para documentación de Vue 3 y Vuetify
- `sequential`: Para ejecución ordenada de pasos
- `dry-run`: Para validación antes de escritura

#### MCPs Requeridos:
```bash
--seq --sequential --c7 --context7
```

#### Archivos a Crear/Modificar:
```
apps/web/src/views/consultation/SimpleInterconsultation.vue (CREAR)
apps/web/src/router/index.ts (MODIFICAR)
apps/api/src/routes/v1/interconsultas.routes.ts (VERIFICAR/CREAR)
```

#### Validaciones Obligatorias:
1. ✅ `npm run type-check` en apps/web
2. ✅ `npm run build` en apps/web
3. ✅ Verificar ruta accesible en router
4. ✅ Validar endpoints de API existentes

---

### FASE 2: TASK-024 - GPS Dinámico y Geolocalización

#### Agente Recomendados:

| Agente | Tipo | Activación | Responsabilidad |
|--------|------|------------|-----------------|
| **backend-architect** | Especializado | ✅ OBLIGATORIO | - Implementar LocationService<br>- Calcular distancias (Haversine)<br>- Diseñar endpoints /geo/* |
| **frontend-architect** | Especializado | ✅ OBLIGATORIO | - Actualizar useGPS.ts<br>- Implementar consentimiento UI<br>- Búsqueda por cercanía |
| **security-engineer** | Especializado | ✅ OBLIGATORIO | - Validar privacy de ubicación<br>- Verificar consentimiento GDPR<br>- Auditar manejo de coordenadas |
| **performance-engineer** | Especializado | ✅ RECOMENDADO | - Optimizar cálculos de distancia<br>- Indexar queries de ubicación<br>- Caché de resultados |

#### Skills Requeridos:
- `context7` (MCP): Para documentación de Geolocation API
- `sequential`: Para pasos dependientes
- `explore`: Para buscar existing GPS code

#### MCPs Requeridos:
```bash
--seq --sequential --c7 --context7
```

#### Archivos a Crear/Modificar:
```
apps/api/src/services/geo/location.service.ts (CREAR)
apps/api/src/routes/v1/geo.routes.ts (CREAR)
apps/api/src/routes/v1/index.ts (MODIFICAR)
apps/web/src/composables/useGPS.ts (MODIFICAR)
apps/web/src/components/geo/LocationConsent.vue (CREAR)
```

#### Validaciones Obligatorias:
1. ✅ `npm run type-check` en apps/api
2. ✅ `npm run build` en apps/api
3. ✅ Testear fórmula Haversine con casos conocidos
4. ✅ Validar permisos de navegador para GPS

---

### FASE 3: TASK-050 - PWA Responsive

#### Agente Recomendados:

| Agente | Tipo | Activación | Responsabilidad |
|--------|------|------------|-----------------|
| **frontend-architect** | Especializado | ✅ OBLIGATORIO | - Crear breakpoints.scss<br>- Implementar responsive.scss<br>- Validar touch-friendly |
| **performance-engineer** | Especializado | ✅ RECOMENDADO | - Optimizar CSS bundle size<br>- Validar Core Web Vitals<br>- Medir impact en mobile |

#### Skills Requeridos:
- `context7` (MCP): Para documentación de Vuetify breakpoints
- `explore`: Para buscar estilos existentes

#### MCPs Requeridos:
```bash
--seq --sequential --c7 --context7
```

#### Archivos a Crear/Modificar:
```
apps/web/src/assets/styles/breakpoints.scss (CREAR)
apps/web/src/assets/styles/responsive.scss (CREAR)
apps/web/src/main.ts (MODIFICAR - importar estilos)
apps/web/src/vuetify.ts (VERIFICAR configuración breakpoints)
```

#### Validaciones Obligatorias:
1. ✅ `npm run build` en apps/web
2. ✅ Testear en Chrome DevTools (mobile/tablet/desktop)
3. ✅ Validar touch targets ≥48px
4. ✅ Verificar Core Web Vitals

---

### FASE 4: TASK-044C - Validación Senescyt

#### Agente Recomendados:

| Agente | Tipo | Activación | Responsabilidad |
|--------|------|------------|-----------------|
| **backend-architect** | Especializado | ✅ OBLIGATORIO | - Implementar SenescytValidationService<br>- Integrar API externa<br>- Manejar errores y retries |
| **security-engineer** | Especializado | ✅ OBLIGATORIO | - Validar manejo de API keys<br>- Auditar timeout y retries<br>- Verificar logging seguro |
| **frontend-architect** | Especializado | ✅ OBLIGATORIO | - Crear componente Validation.vue<br>- Implementar estados de validación<br>- UX de feedback |

#### Skills Requeridos:
- `context7` (MCP): Para documentación de Axios y API integration
- `sequential`: Para pasos de validación
- `explore`: Para buscar existing validation patterns

#### MCPs Requeridos:
```bash
--seq --sequential --c7 --context7
```

#### Archivos a Crear/Modificar:
```
apps/api/src/services/senescyt/validation.service.ts (CREAR)
apps/api/src/routes/v1/senescyt.routes.ts (CREAR)
apps/api/src/routes/v1/index.ts (MODIFICAR)
apps/web/src/components/senescyt/Validation.vue (CREAR)
apps/api/.env.example (MODIFICAR - agregar SENECYT_*)
```

#### Validaciones Obligatorias:
1. ✅ `npm run type-check` en apps/api
2. ✅ `npm run build` en apps/api + apps/web
3. ✅ Validar estructura de respuesta de API Senescyt
4. ✅ Testear error handling (404, 401, timeout)

---

## 🎯 OPTIMIZACIONES RECOMENDADAS

### 1. Parallel Agent Discovery (OBLIGATORIO)
Para cada fase, lanzar **múltiples agentes en PARALELO**:
```
Fase 1: backend-architect + frontend-architect + quality-engineer (3 agentes)
Fase 2: backend-architect + frontend-architect + security-engineer (3 agentes)
Fase 3: frontend-architect + performance-engineer (2 agentes)
Fase 4: backend-architect + security-engineer + frontend-architect (3 agentes)
```

### 2. Context First (GOLDEN RULE #1)
Antes de escribir código:
```bash
# Leer archivos relacionados
read_file: apps/api/src/routes/v1/index.ts
read_file: apps/web/src/router/index.ts
read_file: apps/api/prisma/schema.prisma
```

### 3. Evidence Based (GOLDEN RULE #2)
Después de cada cambio:
```bash
# Mostrar output real
npm run type-check  # Output: 0 errors
npm run build       # Output: Build completed successfully
```

### 4. Pattern Matching (GOLDEN RULE #4)
Mimicar patrones existentes:
```bash
# Buscar patrones similares
grep -r "useApi" apps/web/src/composables/
grep -r "authMiddleware" apps/api/src/routes/
```

### 5. Type Completeness (LEARN-009)
Prohibido usar `any`:
```typescript
// ❌ MAL
const data: any = await api.get('/endpoint');

// ✅ BIEN
interface ApiResponse {
  data: Consultation[];
  total: number;
}
const response: ApiResponse = await api.get('/endpoint');
```

---

## 📋 CHECKLIST DE EJECUCIÓN SECUENCIAL

### Pre-Implementación (OBLIGATORIO)
- [ ] Leer PLAN_IMPLEMENTACION_V1.md completo
- [ ] Leer brain/backlog.json tareas relevantes
- [ ] Leer brain/learnings.json para evitar errores previos
- [ ] Verificar estructura de directorios existente
- [ ] Activar MCPs requeridos (--seq --c7)

### Por Cada Fase
1. [ ] **Simulate**: Describir cambios exactos (archivos, imports, dependencias)
2. [ ] **Confirm**: Verificar archivos existen, imports disponibles
3. [ ] **Execute**: Implementar con agentes especializados
4. [ ] **Validate**: type-check + build + test manual
5. [ ] **Document**: Actualizar backlog.json con estado

### Post-Implementación
- [ ] `npm run type-check` (0 errores en todo el proyecto)
- [ ] `npm run build` (éxito en apps/web + apps/api)
- [ ] `git diff --name-only` (verificar solo archivos intencionados)
- [ ] Actualizar brain/backlog.json con tareas completadas
- [ ] Commit con mensaje estructurado

---

## 🔧 COMANDOS DE ACTIVACIÓN RÁPIDA

### Activar Agentes para Fase 1 (TASK-046)
```bash
# Backend
task: "Implementar routes de interconsulta simplificada"
subagent_type: backend-architect
flags: --seq --c7

# Frontend
task: "Crear componente SimpleInterconsultation.vue"
subagent_type: frontend-architect
flags: --seq --c7

# Quality
task: "Validar criterios de aceptación de TASK-046"
subagent_type: quality-engineer
flags: --seq
```

### Activar Agentes para Fase 2 (TASK-024)
```bash
# Backend
task: "Implementar LocationService con fórmula Haversine"
subagent_type: backend-architect
flags: --seq --c7

# Frontend
task: "Actualizar useGPS.ts y crear LocationConsent.vue"
subagent_type: frontend-architect
flags: --seq --c7

# Security
task: "Auditar privacy de ubicación y consentimiento"
subagent_type: security-engineer
flags: --seq
```

### Activar Agentes para Fase 3 (TASK-050)
```bash
# Frontend
task: "Crear breakpoints.scss y responsive.scss"
subagent_type: frontend-architect
flags: --seq --c7

# Performance
task: "Optimizar CSS bundle y validar Core Web Vitals"
subagent_type: performance-engineer
flags: --seq
```

### Activar Agentes para Fase 4 (TASK-044C)
```bash
# Backend
task: "Implementar SenescytValidationService"
subagent_type: backend-architect
flags: --seq --c7

# Security
task: "Validar manejo seguro de API keys de Senescyt"
subagent_type: security-engineer
flags: --seq

# Frontend
task: "Crear componente Validation.vue"
subagent_type: frontend-architect
flags: --seq --c7
```

---

## ⚠️ ANTI-PATRONES PROHIBIDOS (brain/learnings.json)

| Anti-patrón | Descripción | Prevención |
|-------------|-------------|------------|
| **Ghost Imports** | Importar módulos inexistentes | Verificar con `ls` antes de importar |
| **Type Any Quick Fix** | Usar `as any` para evitar errors | Agregar propiedades a interfaces |
| **Blind Fixes** | Aplicar fix sin leer error/código | Leer error → Leer código → Hipótesis → Fix |
| **Config Drift** | Cambiar configs sin permiso | Pedir confirmación para cambios de config |
| **UX Destructive Edit** | Eliminación física inmediata | Patrón: Cambio visual primero, eliminación al guardar |
| **Blocking Sync in API** | Usar fs.unlinkSync en API routes | Usar fs.promises con Promise.race([timeout]) |

---

## 📊 MÉTRICAS DE ÉXITO POR FASE

| Fase | Métrica | Objetivo | Validación |
|------|---------|----------|------------|
| TASK-046 | Type errors | 0 | `npm run type-check` |
| TASK-046 | Build status | Success | `npm run build` |
| TASK-024 | Distance accuracy | <1% error | Test con coordenadas conocidas |
| TASK-024 | Privacy compliance | 100% | Consentimiento explícito |
| TASK-050 | Responsive breakpoints | 3 dispositivos | Mobile/Tablet/Desktop |
| TASK-050 | Touch targets | ≥48px | Chrome DevTools |
| TASK-044C | API integration | Functional | Test con mock de Senescyt |
| TASK-044C | Error handling | 100% | Test 404, 401, timeout |

---

## 🚀 SECUENCIA DE EJECUCIÓN RECOMENDADA

```
Día 1:
  - Mañana: TASK-046 (Interconsulta Simplificada)
    * backend-architect: 09:00 - 11:00
    * frontend-architect: 09:00 - 11:00 (paralelo)
    * quality-engineer: 11:00 - 12:00
  - Tarde: TASK-050 (PWA Responsive)
    * frontend-architect: 14:00 - 16:00
    * performance-engineer: 16:00 - 17:00

Día 2:
  - Mañana: TASK-024 (GPS Dinámico)
    * backend-architect: 09:00 - 11:00
    * frontend-architect: 09:00 - 11:00 (paralelo)
    * security-engineer: 11:00 - 12:00
  - Tarde: TASK-044C (Validación Senescyt)
    * backend-architect: 14:00 - 16:00
    * security-engineer: 14:00 - 15:00 (paralelo)
    * frontend-architect: 16:00 - 17:00
```

---

## 📝 NOTAS FINALES

1. **Orden de ejecución:** TASK-046 → TASK-024 → TASK-050 → TASK-044C
2. **Activación obligatoria:** Activar agentes ANTES de cada fase
3. **Validación obligatoria:** type-check + build después de cada fase
4. **Documentación obligatoria:** Actualizar backlog.json al completar cada tarea
5. **Higiene del proyecto:** No código espagueti, no errores de infraestructura, no funciones duplicadas

---

**Fin del Plan de Activación de Agentes**
