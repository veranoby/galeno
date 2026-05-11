# Galeno - Product Requirements Document (PRD)

## 1. Visión y Propósito

Plataforma médica SaaS de nueva generación para Ecuador y la región andina. El 'Apple Health' de los médicos. Un ecosistema que unifica agendamiento, historia clínica, firma electrónica nativa, facturación, y telemedicina, apoyado por IA no intrusiva y un Health Wallet del que el paciente es dueño, respetando 100% la LOPDP.

**Métricas y Restricciones Principales:**

- LOPDP compliant - Paciente dueño de su dato médico
- Firma XAdES-BES procesada 100% en cliente (WebCrypto API)
- Clave privada nunca viaja al servidor
- Latencia percibida < 150ms
- IA cost target: < $0.005 por consulta
- Offline-first transparente con resolución de conflictos por timestamp

## 2. Stack Técnico Definitivo

- **Frontend:** React, PWA, Tailwind, TypeScript
- **Backend:** Node.js, Express, Prisma, PostgreSQL
- **Realtime:** SSE (Server-Sent Events) para notificaciones y estado de consultas
- **Offline:** IndexedDB + Service Workers (Offline First, sincro transparente)
- **Seguridad/Firma:** WebCrypto API para firma XAdES-BES en cliente
- **Infraestructura:** Vercel/Netlify (Frontend), Railway/Render (Backend), Supabase/Neon (Database)
- **Telemedicina:** Servidor Jitsi/WebRTC dedicado

## 3. Arquitectura de Alto Nivel

- **Seguridad y Compliance:** LOPDP (Paciente dueño, consentimientos), XAdES-BES, SRI, SENESCYT
- **Encriptación (Reposo):** AES-256 | **(Tránsito):** TLS 1.3
- **Control de Acceso:** Row-Level Security activado. Roles: DOCTOR, ASISTENTE, ENFERMERA, ADMIN, PACIENTE

## 4. Listado Completo de Funcionalidades

### Agendamiento

- [x] Slots configurables **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] GPS Multi-Oficina Dinámico **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Sala de espera virtual **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [ ] Estados de consulta (Agendada, En Sala, En Consulta, etc.) **(0%)**: Ninguna evidencia encontrada en el código actual.

### Consulta

- [x] Historia clínica electrónica **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [ ] IA Copilot (asistencia pasiva) **(0%)**: Ninguna evidencia encontrada en el código actual.
- [x] Módulo de especialidad dinámico **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Antecedentes **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.

### Documentos

- [x] Receta médica electrónica **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Firma XAdES-BES en cliente **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Facturación SRI **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Certificados con caducidad **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.

### Paciente

- [x] Health Wallet (portal de paciente) **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Aprobación de acceso a historia (LOPDP) **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Buscador médico con mapa **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.

### Comunicacion

- [x] Teleconsulta integrada (WebRTC) **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Chat interno/Notificaciones SSE **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Integración WhatsApp (futuro) **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.

### Social

- [x] Galeno Hub (LinkedIn Médico) **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.
- [x] Interconsultas 1-a-1 **(100%)**: Implementado funcionalmente. Componentes, rutas y lógica base halladas.

## 5. Modelo de Negocio y Monetización

- **TAM (Ecuador):** $48M USD/año
- **SAM:** $12M USD/año
- **Ventajas Competitivas (Moats):**
  - Firma P12 en Cliente: Técnico + Legal (100% en cliente, GRATIS)
  - Facturación XML SRI: Integración nativa sin fricción
  - IA Costo: < $0.005/consulta vs $50-200/mes de competencia
  - Offline-first: Operación continua sin internet
- **Unit Economics (Premium):** ARPU $10.0, LTV $249.6, CAC $15 (Payback: 1.5 meses)
- **Go To Market (Adquisición):** SEO/Content, Social Media, Referral Program, Partnerships, Ads (Google)
- **Retención:** Onboarding < 5 min, Valor inmediato, Success Team, Galeno Hub Community

## 6. Fases de Desarrollo MVP

### Fase 1: Launch Q1 2025

- Autenticación y Onboarding (< 5 min)
- Gestión consultas completa (6 estados)
- Agendamiento Híbrido (Slots + GPS Multi-Oficina Dinámico)
- Teleconsulta (WebRTC Pro / Jitsi)
- Firma Electrónica XAdES-BES (100% en cliente, FREE ilimitada)
- Facturación SRI Integrada (PREMIUM)
- IA Copilot (no intrusivo, < $0.005/consulta) e IA Brain
- Health Wallet completo (LOPDP compliant)
- Módulo de Especialidad
- Interconsultas 1-a-1
- PWA responsive, offline-first transparente
- Notificaciones SSE + Push

### Fase 2: Q3 2025

- WebRTC Pro (grabación y análisis avanzado)
- Galeno Hub (LinkedIn Médico + Marketplace)
- Integración WhatsApp (módulo)
- Módulo Migración Pro

## 7. Funcionalidades Ocultas Halladas en el Código

- **Integración de Farmacia (Recetas Electrónicas Avanzadas) (50%)**: ✓ Vale la pena - Expande el servicio al paciente y permite un loop cerrado de prescripción-compra.
- **Módulo de Enfermería (Toma de signos vitales, preparación) (80%)**: ✓ Vale la pena - Indispensable para el workflow real de clínicas con asistentes/enfermeras antes de ver al médico.
- **Triage Automatizado / IA (60%)**: ? Requiere decisión - Útil para pre-evaluar pacientes y optimizar tiempos, pero tiene implicaciones de responsabilidad médica.
- **Módulos de Especialidad Ultra-Específicos (Odontograma, Retina, Crecimiento) (90%)**: ✓ Vale la pena - Crea un 'moat' enorme contra software genérico; retiene especialistas de nicho.
- **Pasarela de Pagos de Consultas (Cobro a pacientes) (75%)**: ✓ Vale la pena - Permite monetización vía take-rate por transacción, más allá de la suscripción mensual SaaS.
