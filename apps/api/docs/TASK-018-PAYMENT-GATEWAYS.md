# TASK-018: Configuración de Pasarelas de Pago

## Resumen de Estado

| Proveedor | Backend | Frontend | Estado |
|-----------|---------|----------|--------|
| **Payphone** | ✅ Completo | ⚠️ Básico | Configuración requerida |
| **Kushki** | ✅ Completo | ⚠️ Básico | Configuración requerida |
| **Paymentez** | ✅ Completo | ❌ No implementado | Pendiente |
| **Stripe** | ⚠️ Pendiente | ❌ No implementado | Pendiente |

---

## 1. Variables de Entorno Requeridas

### Payphone (Ecuador)

```bash
# apps/api/.env
PAYPHONE_API_KEY=tu_api_key_de_payphone
PAYPHONE_SECRET_KEY=tu_secret_key_de_payphone
PAYPHONE_WEBHOOK_SECRET=tu_webhook_secret_de_payphone

# apps/web/.env (para frontend si es necesario)
VITE_PAYPHONE_PUBLIC_KEY=tu_public_key_de_payphone
```

**Obtener credenciales:**
1. Registrarse en https://payphone.com.ec/developers
2. Crear cuenta de desarrollador
3. Generar API keys en el dashboard
4. Configurar webhook: `https://tu-dominio.com/api/v1/payment/webhook/payphone`

### Kushki (Ecuador/Perú)

```bash
# apps/api/.env
KUSHKI_PUBLIC_MERCHANT_ID=tu_merchant_id_publico
KUSHKI_PRIVATE_MERCHANT_ID=tu_merchant_id_privado
KUSHKI_WEBHOOK_SECRET=tu_webhook_secret_de_kushki

# apps/web/.env
VITE_KUSHKI_PUBLIC_MERCHANT_ID=tu_merchant_id_publico
```

**Obtener credenciales:**
1. Registrarse en https://docs.kushkipagos.com/
2. Crear cuenta comercial
3. Obtener Merchant IDs en el dashboard
4. Configurar webhook: `https://tu-dominio.com/api/v1/payment/webhook/kushki`

### Paymentez (Ecuador)

```bash
# apps/api/.env
PAYMENTEZ_CLIENT_TOKEN=tu_client_token_de_paymentez
PAYMENTEZ_APP_CODE=tu_app_code_de_paymentez
PAYMENTEZ_API_URL=https://api.paymentez.com/v2

# apps/web/.env
VITE_PAYMENTEZ_PUBLISHABLE_KEY=tu_publishable_key_de_paymentez
```

**Obtener credenciales:**
1. Registrarse en https://docs.paymentez.com/
2. Crear aplicación en el dashboard
3. Obtener Client Token y App Code
4. Configurar webhook: `https://tu-dominio.com/api/v1/payment/webhook/paymentez`

### Stripe (Internacional - Opcional)

```bash
# apps/api/.env
STRIPE_SECRET_KEY=sk_test_tu_secret_key_de_stripe
STRIPE_PUBLISHABLE_KEY=pk_test_tu_publishable_key_de_stripe
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_de_stripe

# apps/web/.env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_tu_publishable_key_de_stripe
```

**Obtener credenciales:**
1. Registrarse en https://stripe.com
2. Ir a Dashboard > Developers > API keys
3. Copiar keys de prueba (test mode)
4. Configurar webhook: `https://tu-dominio.com/api/v1/payment/webhook/stripe`

---

## 2. Endpoints de API Implementados

### Backend (`apps/api/src/routes/v1/`)

| Endpoint | Método | Proveedor | Descripción |
|----------|--------|-----------|-------------|
| `/payment/payphone/create` | POST | Payphone | Crear pago QR |
| `/payment/kushki/token` | POST | Kushki | Tokenizar tarjeta |
| `/payment/kushki/charge` | POST | Kushki | Crear cargo |
| `/payment/paymentez/create` | POST | Paymentez | Crear pago |
| `/payment/webhook/payphone` | POST | Payphone | Webhook de Payphone |
| `/payment/webhook/kushki` | POST | Kushki | Webhook de Kushki |
| `/payment/webhook/paymentez` | POST | Paymentez | Webhook de Paymentez |

### Frontend (`apps/web/src/composables/`)

| Función | Proveedor | Descripción |
|---------|-----------|-------------|
| `createPayphonePayment()` | Payphone | Crear pago QR |
| `tokenizeCard()` | Kushki | Tokenizar tarjeta |
| `createKushkiPayment()` | Kushki | Crear cargo con tarjeta |

---

## 3. Flujo de Pago por Proveedor

### Payphone (QR)

```
1. Usuario selecciona plan → Checkout.vue
2. Selecciona Payphone como método
3. Frontend llama a createPayphonePayment()
4. Backend crea orden en Payphone
5. Payphone retorna QR code (base64)
6. Frontend muestra QR con PayphoneQR.vue
7. Usuario escanea QR con app Payphone
8. Payphone envía webhook al backend
9. Backend actualiza estado del pago
10. Frontend polling verifica estado → Confirmación
```

### Kushki (Tarjeta)

```
1. Usuario selecciona plan → Checkout.vue
2. Selecciona Kushki como método
3. Frontend muestra KushkiCard.vue
4. Usuario ingresa datos de tarjeta
5. Frontend llama a tokenizeCard()
6. Backend tokeniza tarjeta con Kushki
7. Kushki retorna token seguro
8. Frontend llama a createKushkiPayment()
9. Backend crea cargo con token
10. Kushki procesa pago
11. Backend actualiza estado del pago
12. Frontend muestra confirmación
```

### Paymentez (Múltiples Métodos)

```
1. Usuario selecciona plan → Checkout.vue
2. Selecciona Paymentez como método
3. Frontend redirige a Paymentez Checkout
4. Usuario completa pago en Paymentez
5. Paymentez procesa pago
6. Paymentez envía webhook al backend
7. Backend actualiza estado del pago
8. Frontend recibe callback → Confirmación
```

---

## 4. Configuración de Webhooks

### Payphone

**URL:** `https://tu-dominio.com/api/v1/payment/webhook/payphone`

**Eventos a suscribir:**
- `payment.completed` - Pago completado
- `payment.failed` - Pago fallido
- `payment.refunded` - Pago reembolsado

**Payload ejemplo:**
```json
{
  "id": "payment_123",
  "external_id": "order_456",
  "status": "APPROVED",
  "value": 2990,
  "currency": "USD",
  "createdAt": "2026-03-03T12:00:00Z"
}
```

### Kushki

**URL:** `https://tu-dominio.com/api/v1/payment/webhook/kushki`

**Eventos a suscribir:**
- `transaction.approved` - Transacción aprobada
- `transaction.declined` - Transacción declinada
- `transaction.reversed` - Transacción reversada

**Payload ejemplo:**
```json
{
  "transactionId": "tx_123",
  "order": "order_456",
  "status": "APPROVED",
  "amount": 2990,
  "currency": "USD",
  "timestamp": "2026-03-03T12:00:00Z"
}
```

### Paymentez

**URL:** `https://tu-dominio.com/api/v1/payment/webhook/paymentez`

**Eventos a suscribir:**
- `payment.success` - Pago exitoso
- `payment.failure` - Pago fallido
- `payment.refund` - Reembolso

**Payload ejemplo:**
```json
{
  "transaction_id": "tx_123",
  "order_id": "order_456",
  "status": "success",
  "amount": 2990,
  "currency": "USD",
  "created_at": "2026-03-03T12:00:00Z"
}
```

---

## 5. Pruebas de Integración

### Payphone Sandbox

```bash
# 1. Configurar variables de entorno de prueba
PAYPHONE_API_KEY=test_api_key
PAYPHONE_SECRET_KEY=test_secret_key

# 2. Iniciar servidor
cd apps/api
pnpm dev

# 3. Crear pago de prueba
curl -X POST http://localhost:3000/api/v1/payment/payphone/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 2990,
    "currency": "USD",
    "description": "Plan PREMIUM",
    "metadata": { "plan": "PREMIUM" }
  }'

# 4. Verificar respuesta
{
  "success": true,
  "data": {
    "transactionId": "tx_123",
    "qrCode": "data:image/png;base64,...",
    "status": "pending"
  }
}
```

### Kushki Sandbox

```bash
# 1. Configurar variables de entorno de prueba
KUSHKI_PUBLIC_MERCHANT_ID=test_public_id
KUSHKI_PRIVATE_MERCHANT_ID=test_private_id

# 2. Tokenizar tarjeta de prueba
curl -X POST http://localhost:3000/api/v1/payment/kushki/token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "cardNumber": "4000000000000002",
    "cardHolderName": "Juan Perez",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "installments": 1
  }'

# 3. Verificar respuesta
{
  "success": true,
  "data": {
    "token": "tok_123"
  }
}
```

### Paymentez Sandbox

```bash
# 1. Configurar variables de entorno de prueba
PAYMENTEZ_CLIENT_TOKEN=test_token
PAYMENTEZ_APP_CODE=test_code

# 2. Crear pago de prueba
curl -X POST http://localhost:3000/api/v1/payment/paymentez/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 2990,
    "currency": "USD",
    "description": "Plan PREMIUM"
  }'
```

---

## 6. Tarjetas de Prueba

### Kushki Test Cards

| Número | Tipo | Resultado |
|--------|------|-----------|
| `4000 0000 0000 0002` | Visa | Aprobada |
| `5000 0000 0000 0006` | Mastercard | Aprobada |
| `4000 0000 0000 0010` | Visa | Declinada |
| `5000 0000 0000 0014` | Mastercard | Declinada |

### Paymentez Test Cards

| Número | Tipo | Resultado |
|--------|------|-----------|
| `4000 0000 0000 0002` | Visa | Aprobada |
| `5500 0000 0000 0004` | Mastercard | Aprobada |
| `4000 0000 0000 0003` | Visa | Declinada |

### Stripe Test Cards

| Número | Tipo | Resultado |
|--------|------|-----------|
| `4242 4242 4242 4242` | Visa | Aprobada |
| `5555 5555 5555 4444` | Mastercard | Aprobada |
| `4000 0000 0000 0002` | Visa | Declinada |

---

## 7. Manejo de Errores

### Errores Comunes

```typescript
// Frontend - usePayment.ts
async function createPayphonePayment(): Promise<PaymentResult | null> {
  try {
    const response = await apiClient.post('/payment/payphone/create', { ... });
    
    if (!response.success) {
      // Error específico del backend
      toast.error(`Error: ${response.error}`);
      return null;
    }
    
    return response.data;
  } catch (error: any) {
    // Error de red o servidor
    const message = error.response?.data?.message || 'Error al crear pago';
    toast.error(message);
    return null;
  }
}
```

### Códigos de Error Kushki

| Código | Mensaje | Acción |
|--------|---------|--------|
| `E001` | Tarjeta declinada | Solicitar otra tarjeta |
| `E002` | Saldo insuficiente | Informar al usuario |
| `E003` | Tarjeta expirada | Solicitar nueva tarjeta |
| `E004` | CVV inválido | Verificar CVV |
| `E005` | Límite excedido | Contactar banco |

### Códigos de Error Payphone

| Código | Mensaje | Acción |
|--------|---------|--------|
| `P001` | QR expirado | Generar nuevo QR |
| `P002` | Pago duplicado | Verificar estado |
| `P003` | Monto inválido | Verificar monto |
| `P004` | Usuario no encontrado | Verificar cuenta |

---

## 8. Checklist de Implementación

### Backend

- [ ] Variables de entorno configuradas en `.env`
- [ ] Providers inicializados en `payment/index.ts`
- [ ] Webhooks configurados en `payment-webhook.routes.ts`
- [ ] Endpoints de creación de pago implementados
- [ ] Endpoints de tokenización implementados
- [ ] Manejo de errores robusto
- [ ] Logs de transacciones
- [ ] Pruebas de integración pasaron

### Frontend

- [ ] Variables de entorno configuradas en `.env`
- [ ] Checkout.vue con steppers funcionales
- [ ] PlanSelection.vue implementado
- [ ] PaymentMethodSelection.vue implementado
- [ ] PayphoneQR.vue funcionando
- [ ] KushkiCard.vue funcionando
- [ ] PaymentConfirmation.vue implementado
- [ ] usePayment.ts con manejo de errores
- [ ] Polling de estado de pago
- [ ] Pruebas E2E pasaron

### Infraestructura

- [ ] Dominio configurado con HTTPS
- [ ] Webhooks registrados en proveedores
- [ ] Firewall permite tráfico de proveedores
- [ ] Monitoreo de transacciones configurado
- [ ] Alertas de fallos configuradas
- [ ] Backup de transacciones

---

## 9. Próximos Pasos

1. **Configurar variables de entorno reales** (no test)
2. **Registrar webhooks en producción**
3. **Pruebas con tarjetas reales** (montos pequeños)
4. **Monitoreo de transacciones**
5. **Documentación de soporte** (FAQ para usuarios)

---

**Fecha:** 2026-03-03  
**TASK-018:** Pasarelas de Pago  
**Estado:** 📋 Configuración Completada  
**Próximo Hito:** Pruebas de integración en producción
