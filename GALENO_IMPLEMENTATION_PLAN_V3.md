# 🛡️ GALENO: Plan Maestro de Implementación v3.0 (Fase Monetización & Optimización)

**Objetivo:** Desplegar infraestructura de pagos dual (PayPhone/PayPal), internacionalización y optimizaciones críticas post-MVP.
**Estándar:** Zero-Trust, Idempotencia transaccional, Auditoría LOPDP inmutable.

---

## 🏗️ Fase 0: Preparación del Entorno (Infraestructura)

**Agente Responsable:** `devops-architect`
**Skills Requeridos:** `database-optimization`, `system-hardening`

### 1. Setup Base de Datos Local & Seed SuperAdmin
*   **Tarea:** Inicializar entorno local con datos semilla críticos para pruebas.
*   **Archivo Objetivo:** `apps/api/prisma/seed.ts`
*   **Detalle Técnico:**
    *   Crear usuario `SUPER_ADMIN` con credenciales de `brain/test_credentials.md`.
    *   Crear planes bases: `FREE` (id: 1), `PREMIUM` (id: 2, $10), `CLINICA_SME` (id: 3, $45).
    *   **Validación:** El seed debe ser idempotente (usar `upsert`).
*   **Comando:** `npx prisma db seed`

### 2. Configuración de Variables de Entorno
*   **Tarea:** Actualizar `.env` local con credenciales simuladas.
*   **Detalle Técnico:**
    *   `PAYPHONE_ID`: `123456789` (Sandbox)
    *   `PAYPHONE_SECRET`: `secret_sandbox_key`
    *   `PAYPAL_CLIENT_ID`: `sb-client-id`
    *   `PAYPAL_SECRET`: `sb-secret`
    *   `GEO_API_KEY`: `mock_geo_key` (Para detección de país local)

---

## 💳 Fase 1: Arquitectura de Pagos (Strategy Pattern)

**Agente Responsable:** `backend-architect`
**Skills Requeridos:** `payment-integration-specialist`, `secure-coding`

### 1. Implementación del Patrón Estrategia
*   **Tarea:** Refactorizar `PaymentService` para soportar múltiples pasarelas dinámicamente.
*   **Archivos:**
    *   `apps/api/src/services/payment/strategies/payment.strategy.interface.ts`
    *   `apps/api/src/services/payment/strategies/payphone.strategy.ts`
    *   `apps/api/src/services/payment/strategies/paypal.strategy.ts`
    *   `apps/api/src/services/payment/payment.context.ts`
*   **Lógica de Selección:**
    *   Si `user.country === 'EC'`, usar `PayPhoneStrategy`.
    *   Si `user.country !== 'EC'`, usar `PayPalStrategy`.

### 2. PayPhone Integration (Ecuador)
*   **Endpoint:** `POST /api/v1/payments/payphone/init`
*   **Payload:** `{ amount: 1000, tax: 120, currency: 'USD', clientTxId: 'uuid' }`
*   **Flujo:**
    1.  Crear transacción en estado `PENDING` en DB.
    2.  Llamar API PayPhone `Prepare`.
    3.  Retornar `paymentUrl` al frontend.
*   **Webhook:** `POST /api/v1/payments/payphone/webhook`
    *   **Seguridad:** Validar firma HMAC-SHA256 del header `X-PayPhone-Signature`.
    *   **Acción:** Actualizar estado a `COMPLETED` o `REJECTED`. Activar Plan si es exitoso.

### 3. PayPal Integration (Internacional)
*   **Endpoint:** `POST /api/v1/payments/paypal/subscription`
*   **Payload:** `{ planId: 'P-...' }`
*   **Flujo:**
    1.  Crear suscripción vía API PayPal (`/v1/billing/subscriptions`).
    2.  Retornar `approvalUrl` al frontend.
*   **Webhook:** `POST /api/v1/payments/paypal/webhook`
    *   **Evento:** `BILLING.SUBSCRIPTION.ACTIVATED`
    *   **Seguridad:** Validar `Paypal-Transmission-Sig`.

---

## 🌍 Fase 2: Internacionalización & Frontend

**Agente Responsable:** `frontend-architect`
**Skills Requeridos:** `ux-optimization`, `geo-location`

### 1. Detección de País (Geo-IP)
*   **Archivo:** `apps/api/src/middleware/geo-ip.ts`
*   **Lógica:** Usar librería `geoip-lite` o servicio `ipapi.co` (con fallback a 'EC' si falla en local).
*   **Output:** Inyectar `req.userCountry` en el request context.

### 2. Componente de Checkout Inteligente
*   **Archivo:** `apps/web/src/views/payment/Checkout.vue`
*   **Lógica:**
    *   Consultar `GET /api/v1/config/payment-methods`.
    *   Renderizar botón "Pagar con PayPhone" (Si EC) o "Suscribirse con PayPal" (Si !EC).
    *   Mostrar precios con/sin IVA según país (Ecuador: +15% IVA, Int: 0% IVA - Exportación de servicios).

---

## 🚀 Fase 3: Optimizaciones Post-MVP (Hardening)

**Agente Responsable:** `performance-engineer`
**Skills Requeridos:** `redis-caching`, `security-audit`

### 1. Optimización de Costos IA (Créditos)
*   **Tarea:** Implementar sistema de cuotas para uso de IA Gemini Flash.
*   **Archivo:** `apps/api/src/services/ai/quota.service.ts`
*   **Lógica:**
    *   Plan FREE: 5 consultas/día.
    *   Plan PREMIUM: 100 consultas/día.
    *   Validar en Redis antes de llamar a Gemini API (`INCR galeno:quota:{userId}`).

### 2. Persistencia de Telemetría
*   **Tarea:** Guardar métricas de calidad de teleconsulta.
*   **Archivo:** `apps/api/src/services/telemetry/metrics.service.ts`
*   **Modelo:** `MetricLog` (Prisma). Campos: `jitter`, `latency`, `packetLoss`, `sessionId`.
*   **Trigger:** Al finalizar consulta (evento socket `call_ended`).

### 3. Webhooks WhatsApp (Status Tracking)
*   **Tarea:** Rastrear entrega de mensajes.
*   **Endpoint:** `POST /api/v1/webhooks/whatsapp`
*   **Lógica:** Actualizar estado de notificación en DB (`DELIVERED`, `READ`).

### 4. Modo Offline Farmacia (PWA)
*   **Tarea:** Cachear llaves públicas de validación.
*   **Archivo:** `apps/web/src/sw.js` (Service Worker)
*   **Estrategia:** `Stale-While-Revalidate` para `/api/v1/pharmacy/keys`. Permitir validación de firma offline usando librería `node-forge` en el cliente.

---

## ✅ Criterios de Aceptación (Quality Gates)

1.  **Cobertura de Tests:** >85% en `PaymentService`.
2.  **Seguridad:** Ningún secreto (API Key) hardcodeado. Webhooks validados con firma criptográfica.
3.  **Performance:** Checkout renderiza en <200ms. Detección de país <50ms (Redis cache).
4.  **UX:** Fallback elegante si pasarela falla (Botón "Reintentar" o "Contactar Soporte").

---
**Firmado:** Arquitecto de Soluciones Galeno
**Fecha:** 10 Marzo 2026
