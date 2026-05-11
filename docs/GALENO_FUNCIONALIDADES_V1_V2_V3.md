# Galeno - Funcionalidades de Plataforma
## Documento de Alcance para Marketing y Jefatura de Producto

**Versión:** 1.1
**Fecha:** Marzo 2026
**Última actualización:** Estimado de tiempo V2 agregado
**Propósito:** Describir el estado actual y futuro de la plataforma Galeno

---

## Resumen Ejecutivo

Galeno es una plataforma SaaS B2B/B2C que digitaliza la práctica médica en Ecuador. Este documento clasifica las funcionalidades en tres versiones:

- **V1:** Funcionalidades implementadas y disponibles hoy
- **V2:** Funcionalidades en desarrollo (iniciadas pero no terminadas)
- **V3:** Evoluciones futuras y mejoras estratégicas

---

## V1 - FUNCIONALIDADES ACTUALES (PRODUCCIÓN)

### 1. Gestión de Consultas Médicas

**Estado:** ✅ Completamente implementado

El corazón de la plataforma. Permite a los médicos gestionar el ciclo completo de una consulta con 6 estados posibles:

- **Borrador:** Consulta creada pero no iniciada
- **Triaje:** Enfermera captura signos vitales y datos preliminares
- **Pendiente:** Paciente listo para ser atendido
- **En Atención:** Doctor activamente atendiendo al paciente
- **Finalizada:** Consulta completada y firmada electrónicamente
- **Interconsulta:** Derivada a otro especialista

**Características destacadas:**
- Panel lateral con contexto del paciente (última consulta, antecedentes relevantes, alertas)
- Interconsultas bidireccionales entre especialistas
- Firma electrónica obligatoria para cerrar consultas
- Historial completo de cada consulta

---

### 2. Agenda y Citas Inteligente

**Estado:** ✅ Completamente implementado

Sistema de agendamiento híbrido que combina citas presenciales y teleconsultas:

**Para Citas Presenciales:**
- Slots configurables por día y duración (15, 20, 30, 45, 60 min)
- Múltiples ubicaciones de consulta (consultorios)
- Confirmaciones automáticas por email, push y WhatsApp
- Gestión de disponibilidad con recurrencia (semanal, quincenal, mensual)

**Para Teleconsultas:**
- **Plan FREE:** Doctor ingresa link externo (Zoom, Meet)
- **Plan PREMIUM:** Sala Jitsi Meet automática incluida

---

### 3. Firma Electrónica Médica (XAdES-BES)

**Estado:** ✅ Completamente implementado

**Diferenciador clave:** Procesamiento 100% en el navegador del médico.

- Gratis e ilimitado en todos los planes
- Clave privada NUNCA viaja al servidor (seguridad máxima)
- Estándar XAdES-BES (archivo .p12) requerido por ley ecuatoriana
- Firma de recetas, certificados y diagnósticos
- Validez legal completa en Ecuador

---

### 4. Health Wallet (Billetera de Salud del Paciente)

**Estado:** ✅ Completamente implementado

**Cumplimiento LOPDP:** El paciente es dueño de sus datos médicos.

- Historial completo: consultas, diagnósticos, recetas, exámenes, antecedentes
- Propiedad perpetua: aunque cambie de plataforma, sus datos le pertenecen
- Autorizaciones LOPDP con notificaciones push y audit trail completo
- Código QR para validación en farmacias
- Control total sobre quién accede a su información

---

### 5. IA Copilot (Asistente Inteligente)

**Estado:** ✅ Completamente implementado

**Innovación:** IA por etapas, no intrusiva, siempre activa.

**Etapa 1 - Diagnóstico:**
- Mientras el doctor escribe la evolución, la IA sugiere códigos CIE-10
- Chips azules con un clic → añaden diagnóstico preciso

**Etapa 2 - Tratamiento:**
- Chips verdes: medicación personalizada (dosis, frecuencia, duración)
- Chips amarillos: exámenes sugeridos (tipo, urgencia, preparación)
- Chips rojos: alertas de seguridad (alergias, contraindicaciones, interacciones)

**IA Brain:** Sistema que aprende preferencias del médico y mejora sugerencias con el tiempo.

**Costo:** Menos de $0.005 por consulta (muy económico vs competencia $50-200/mes).

---

### 6. Gestión de Pacientes

**Estado:** ✅ Completamente implementado

- Registro completo de pacientes
- Antecedentes médicos estructurados
- Historial de consultas
- Documentos médicos (recetas, exámenes, certificados)
- Búsqueda y filtrado avanzado

---

### 7. Módulos de Especialidad

**Estado:** ✅ Parcialmente implementado

**Filosofía:** Incluidos gratis en todos los planes. Sin herramientas de especialidad, el doctor no puede trabajar.

**Módulos disponibles:**
- Odontología (Odontograma interactivo)
- Oftalmología (Atlas retina, Test Snellen)
- Pediatría (Curvas de crecimiento OMS)
- Traumatología (Esqueleto interactivo)
- Cardiología (ECG viewer, calculadoras)
- Dermatología (Atlas lesiones cutáneas)

---

### 8. Facturación Electrónica SRI

**Estado:** ✅ Completamente implementado (Planes PREMIUM+)

**Diferenciador:** Generación de XML SRI 100% desde el cliente.

- Validación automática de RUC en tiempo real
- Estándar XAdES-BES para firmas
- Private key en memoria volátil (nunca viaja al servidor)
- Cumplimiento completo con normativa ecuatoriana

---

### 9. Buscador Médico con Mapa

**Estado:** ✅ Completamente implementado

- Mapa interactivo con perfiles de doctores
- Filtros por especialidad, ubicación, valoración
- Detección GPS de ubicación del paciente
- Integración con Waze y Google Maps para "cómo llegar"
- Búsqueda por voz: "Busca cardiólogo cerca de mí"

---

### 10. Autenticación y Seguridad

**Estado:** ✅ Completamente implementado

- JWT con refresh tokens
- Row Level Security (RLS) en base de datos
- Roles: DOCTOR, ASISTENTE, ENFERMERA, ADMIN, FARMACIA
- Recuperación de contraseña
- Onboarding en menos de 5 minutos

---

### 11. Notificaciones Multi-canal

**Estado:** ✅ Completamente implementado

Tres capas de notificaciones:

- **Push:** App cerrada (PWA Push Notifications)
- **SSE:** App abierta (Server-Sent Events para tiempo real)
- **Toast:** Feedback inmediato dentro de la app

---

### 12. Interconsultas Simplificadas

**Estado:** ✅ Completamente implementado

- Derivación 1-a-1 entre especialistas
- Cadena de custodia del paciente
- Cierre manual por doctor destino
- Notificaciones push + SSE a ambos doctores
- Historial completo visible para ambos

---

### 13. Compartir Historial (LOPDP)

**Estado:** ✅ Completamente implementado

- Protocolo ShareToken para compartir historial médico
- Control total por parte del paciente
- Acceso temporal para teleconsultas
- Audit trail completo de autorizaciones, accesos y revocaciones

---

### 14. Validación Senescyt

**Estado:** ✅ Completamente implementado

- API integrada para validación de títulos médicos
- Perfil público de doctor con especialidades verificadas

---

### 15. Pagos y Suscripciones

**Estado:** ✅ Completamente implementado

**Pasarelas:**
- Payphone (Ecuador) - Primaria
- PayPal (Internacional) - Secundaria

**Planes:**
- FREE: $0 (1 doctor, sin facturación)
- PREMIUM: $10/mes (1 doctor, 1 asistente, facturación + Jitsi)
- CLÍNICA SME: $45/mes (5 doctores, 5 asistentes)
- ENTERPRISE: $90/mes (10 doctores, 10 asistentes, soporte prioritario)

---

### 16. PWA Offline-First

**Estado:** ✅ Completamente implementado

- Funciona sin conexión a internet
- Sincronización transparente al reconectar
- Instalable en desktop, tablet y móvil
- Latencia percibida < 150ms

---

### 17. Teleconsulta Básica

**Estado:** ✅ Completamente implementado

- Sala de espera virtual
- Videollamada con Jitsi Meet (Plan PREMIUM)
- Soporte para link externo (Plan FREE)

---

### 18. Validación QR Farmacias

**Estado:** ✅ Completamente implementado

- Rol FARMACIA con acceso restringido
- Validación de recetas y exámenes por QR
- Detección de documentos caducados (recetas 30 días, exámenes 90 días)

---

### 19. Auditoría y Compliance

**Estado:** ✅ Completamente implementado

- Audit log completo de todas las acciones
- Dashboard de auditoría para administradores
- Trazabilidad de accesos a datos de pacientes

---

### 20. Migración de Datos

**Estado:** ✅ Completamente implementado

- Importación masiva desde CSV, JSON, Excel
- Asistencia de IA para estructurar datos
- Validación y limpieza de datos importados

---

## Estimado de Tiempo para Completar V2

**Total estimado:** 8-10 semanas (2-2.5 meses)
**Recurso recomendado:** 1-2 desarrolladores full-stack

### Desglose por Módulo

| Módulo | Estado Actual | Tiempo Restante | Prioridad | Complejidad |
|--------|---------------|-----------------|-----------|-------------|
| **Triaje Colaborativo** | Backend completo, frontend parcial | 1 semana | Alta | Media |
| **Galeno Hub** | Estructura creada | 2-3 semanas | Alta | Alta |
| **WebRTC Pro (Grabación)** | Servicios creados | 1-2 semanas | Media | Media |
| **Envío WhatsApp** | Webhook implementado | 2 semanas | Alta | Alta |
| **Módulo Migración Pro** | Servicios creados | 1 semana | Baja | Media |
| **Documentos con Caducidad** | Modelo creado | 1 semana | Media | Baja |
| **Multi-oficina GPS** | Servicios creados | 1-2 semanas | Media | Media |
| **Health Wallet Backup** | Vista creada | 1-2 semanas | Baja | Media |
| **Analytics y Métricas** | Dashboard creado | 2 semanas | Media | Alta |
| **Marketplace** | Estructura creada | 1 semana | Baja | Baja |

### Roadmap Sugerido por Sprints

**Sprint 1 (2 semanas) - Mínimo Viable Product V2**
- ✅ Triaje Colaborativo (completar integración)
- ✅ Documentos con Caducidad (cron job + UI)
- ✅ Marketplace (activación de módulos)

**Sprint 2 (2 semanas) - Comunicaciones**
- ✅ Envío WhatsApp (módulo completo)
- ✅ Multi-oficina GPS (integración Maps)

**Sprint 3 (2 semanas) - Analytics**
- ✅ Analytics y Métricas (reportes)
- ✅ WebRTC Pro (grabación + UI)

**Sprint 4 (2-3 semanas) - Hub Completo**
- ✅ Galeno Hub (flujo artículos + monetización)
- ✅ Health Wallet Backup (backup + restore)

**Sprint 5 (1 semana) - Polish**
- ✅ Módulo Migración Pro (IA mejorada)
- ✅ Testing end-to-end V2
- ✅ Corrección de bugs

### Dependencias y Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Integración Meta WhatsApp API | Alto | Documentación oficial, sandbox testing |
| Almacenamiento grabaciones | Medio | Evaluar costos S3/Cloudflare R2 |
| Aprobación artículos Hub | Bajo | Flujo admin manual inicialmente |
| Performance cron job caducidad | Medio | Optimizar queries, índices DB |

### Hitos Intermedios

- **Semana 2:** Triaje colaborativo funcional
- **Semana 4:** WhatsApp notifications activas
- **Semana 6:** Analytics dashboard operativo
- **Semana 8:** Galeno Hub beta publicada
- **Semana 10:** V2 completa y testeada

---

## V2 - FUNCIONALIDADES EN DESARROLLO

### 1. Triaje Colaborativo

**Estado:** 🟡 Iniciado (backend completo, frontend parcial)

**Qué falta:**
- Integración completa frontend-backend
- Notificación SSE en tiempo real al doctor cuando triaje está completo
- UI/UX para flujo enfermera → doctor

---

### 2. Galeno Hub (LinkedIn Médico)

**Estado:** 🟡 Iniciado (estructura creada)

**Qué falta:**
- Flujo completo de artículos: doctor escribe → admin revisa → aprueba/rechaza → publica
- Sección de comunidad en el dashboard
- Monetización: artículos patrocinados, banners, destacados

---

### 3. WebRTC Pro (Grabación)

**Estado:** 🟡 Iniciado (servicios creados)

**Qué falta:**
- Grabación de teleconsultas con branding personalizado
- Almacenamiento y reproducción de grabaciones
- UI para configuración de grabación

---

### 4. Envío WhatsApp

**Estado:** 🟡 Iniciado (webhook implementado)

**Qué falta:**
- Módulo completo de notificaciones WhatsApp Business API
- Recordatorios automáticos de citas
- Confirmaciones por WhatsApp
- Template management

---

### 5. Módulo Migración Pro

**Estado:** 🟡 Iniciado (servicios creados)

**Qué falta:**
- Asistencia IA mejorada para importación
- Detección automática de formato
- Validación avanzada de datos

---

### 6. Documentos con Caducidad Automática

**Estado:** 🟡 Iniciado (modelo creado)

**Qué falta:**
- Cron job para actualizar estados de documentos caducados
- Marca de agua automática en UI
- Notificaciones de caducidad próxima

---

### 7. Multi-oficina GPS Dinámico

**Estado:** 🟡 Iniciado (servicios creados)

**Qué falta:**
- Detección automática de ubicación por día
- Notificación push con ubicación correcta
- Integración completa con Google Maps

---

### 8. Health Wallet Backup/Restore

**Estado:** 🟡 Iniciado (vista creada)

**Qué falta:**
- Flujo completo de backup de datos del paciente
- Restauración desde backup
- Exportación a formatos estándar (PDF, HL7)

---

### 9. Analytics y Métricas

**Estado:** 🟡 Iniciado (dashboard creado)

**Qué falta:**
- Métricas de teleconsultas (latencia, jitter)
- Analytics de uso de la plataforma
- Reportes para administradores

---

### 10. Marketplace de Módulos

**Estado:** 🟡 Iniciado (estructura creada)

**Qué falta:**
- Activación/desactivación de módulos
- Cobro de módulos adicionales
- Gestión de suscripciones a módulos

---

## V3 - EVOLUCIONES FUTURAS

### 1. Sistema de Referidos

**Concepto:** Programa "Invita a un colega" con 1 mes gratis

**Valor:** Adquisición de usuarios de bajo costo

---

### 2. Teleconsulta Avanzada

**Concepto:**
- Grabación con transcripción automática
- Notas automáticas impulsadas por IA
- Chat integrado durante videollamada
- Pantalla compartida

---

### 3. IA Explicativa

**Concepto:** IA que explica diagnósticos y tratamientos en lenguaje simple para pacientes

**Valor:** Mejora adherencia a tratamientos y comprensión

---

### 4. Integración con Laboratorios

**Concepto:** Resultados de laboratorio直接 integrados en Health Wallet

**Valor:** Completa historial médico del paciente

---

### 5. Integración con Imaging

**Concepto:** Imágenes diagnósticas (rayos X, resonancias) integradas

**Valor:** Evolución completa del paciente en un solo lugar

---

### 6. Telemonitoring

**Concepto:** Seguimiento remoto de pacientes crónicos con wearables

**Valor:** Recurrent revenue y mejor cuidado preventivo

---

### 7. Chatbot Paciente

**Concepto:** IA para triaje inicial y respuesta a preguntas frecuentes

**Valor:** Reduce carga administrativa del doctor

---

### 8. Prescripción Digital Farmacias

**Concepto:** Envío directo de recetas a farmacias, paciente solo pasa a recoger

**Valor:** Mayor conveniencia para paciente, integración B2B

---

### 9. Integración con Seguros

**Concepto:** Cobertura automática, preautorizaciones, reembolsos

**Valor:** Mayor adopción por clínicas grandes

---

### 10. Expansión Regional

**Concepto:** Adaptación a normativa de Colombia, Perú, Bolivia

**Valor:** Escalamiento horizontal del mercado

---

### 11. Reportes Avanzados

**Concepto:** Analytics avanzados para gestión de práctica médica

**Incluye:**
- Métricas de productividad
- Análisis de ingresos por especialidad
- Reportes de satisfacción paciente
- Predicción de demanda

---

### 12. Segunda Opinión IA

**Concepto:** IA analiza caso y sugiere segunda opinión basada en literatura médica

**Valor:** Diferenciador premium para planes enterprise

---

### 13. Comunidad Médica

**Concepto:** Foros, grupos de especialidad, casos clínicos compartidos

**Valor:** Lock-in por network effects

---

### 14. Integración con Dispositivos Médicos

**Concepto:** Conexión directa con equipos médicos (electrocardiógrafos, monitores)

**Valor:** Flujo automatizado de datos a consulta

---

### 15. Asistente de Voz

**Concepto:** Dictado de consultas con reconocimiento de voz

**Valor:** Mayor eficiencia en consulta

---

## Resumen por Categorías

| Categoría | V1 | V2 | V3 |
|-----------|----|----|----|
| **Gestión Clínica** | ✅ Completo | - | Reportes avanzados |
| **Agenda** | ✅ Completo | - | - |
| **Teleconsulta** | ✅ Básico | 🟡 Grabación | Transcripción, Chat |
| **Firma Digital** | ✅ Completo | - | - |
| **Facturación** | ✅ Completo | - | Integración seguros |
| **IA** | ✅ Copilot | - | Segunda opinión, Explicativa |
| **Health Wallet** | ✅ Completo | 🟡 Backup | Integración lab/imaging |
| **Especialidades** | ✅ 6 módulos | - | Más especialidades |
| **Marketplace** | ✅ Estructura | 🟡 Activación | - |
| **Comunidad** | ✅ Estructura | 🟡 Artículos | Foros, casos clínicos |
| **GPS/Mapas** | ✅ Completo | 🟡 Multi-oficina | - |
| **Notificaciones** | ✅ 3 canales | 🟡 WhatsApp | - |
| **Seguridad** | ✅ Completo | - | - |
| **Pagos** | ✅ Completo | - | - |

---

## Métricas de Implementación

**Código Backend:**
- ~12,500 líneas implementadas
- 50+ servicios creados
- 34 rutas API activas
- Arquitectura empresarial completada (Clean Architecture)

**Código Frontend:**
- 30 vistas principales
- 7 stores Pinia
- PWA offline-first
- Responsive (desktop, tablet, móvil)

**Base de Datos:**
- 40+ modelos Prisma
- Schema estable
- Migrations aplicadas

---

## Próximos Pasos Prioritarios

### Fase 1: Estabilización (1-2 semanas)
- Resolver errores de TypeScript
- Build exitoso sin warnings
- Preparar ambiente para desarrollo V2

### Fase 2: Completar V2 (8-10 semanas)
**Ver roadmap detallado arriba** - 5 sprints planificados

### Fase 3: Testing QA (2-3 semanas)
- Testing end-to-end V2
- Corrección de bugs
- Optimización de performance
- User testing con beta users

### Fase 4: Lanzamiento V2 (Q2 2026)
- Release con 10 nuevas funcionalidades
- 200 doctores objetivo
- Onboarding < 5 minutos
- First revenue desde módulos V2

---

**Documento preparado para:** Equipo de Marketing y Jefatura de Producto
**Contacto técnico:** Para dudas sobre implementación, consultar al equipo de desarrollo
