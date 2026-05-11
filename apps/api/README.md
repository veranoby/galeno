# Galeno API

API RESTful para el sistema de gestión médica Galeno.

## Quick Start

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar migraciones de Prisma
pnpm prisma migrate dev

# Iniciar servidor de desarrollo
pnpm dev

# Build de producción
pnpm build
```

## Estructura del Proyecto

```
apps/api/
├── src/
│   ├── routes/              # Endpoints de la API
│   │   ├── v1/              # Versión 1 de la API
│   │   └── ...
│   ├── services/            # Lógica de negocio
│   ├── middleware/          # Middleware de Express
│   ├── config/              # Configuración de servicios
│   ├── utils/               # Utilidades
│   └── types/               # Tipos TypeScript
├── prisma/
│   ├── schema.prisma        # Schema de base de datos
│   └── migrations/          # Migraciones
├── docs/                    # Documentación
└── tests/                   # Tests
```

## Patrones de Código

### Patrón de Rutas Express

Para crear nuevos archivos de rutas, seguir el patrón establecido:

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.js';

const router: Router = Router();

router.get('/endpoint', authMiddleware, async (req, res) => {
  // Handler logic
});

export default router;
```

**NO usar:**
```typescript
import express from 'express';
const router = express.Router() as express.Router;  // ❌
```

Para más detalles, ver [docs/checklist-new-route.md](./docs/checklist-new-route.md).

## Endpoints Principales

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/register` - Registrar cuenta
- `POST /api/v1/auth/refresh` - Refresh token

### Pacientes
- `GET /api/v1/patients` - Listar pacientes
- `POST /api/v1/patients` - Crear paciente
- `GET /api/v1/patients/:id` - Obtener paciente

### Consultas
- `GET /api/v1/consultas` - Listar consultas
- `POST /api/v1/consultas` - Crear consulta
- `GET /api/v1/consultas/:id` - Obtener consulta

### Interconsultas
- `GET /api/v1/interconsultas/simple` - Listar interconsultas
- `POST /api/v1/interconsultas/simple` - Crear interconsulta
- `PATCH /api/v1/interconsultas/simple/:id/cerrar` - Cerrar interconsulta

### Pagos
- `POST /api/v1/payments/method` - Guardar método de pago
- `POST /api/v1/payments/subscription` - Crear suscripción
- `POST /api/v1/payments/webhook/*` - Webhooks de proveedores

## Servicios Principales

### Payment Service
Maneja integración con pasarelas de pago (Payphone, Kushki):

```typescript
import { paymentService } from './services/payment/index.js';

// Crear pago único
await paymentService.createPayment('payphone', {
  amount: 1000,
  currency: 'USD',
  customerId: 'user_123',
  description: 'Consulta médica'
});

// Verificar pago
await paymentService.verifyPayment('payphone', 'transaction_123');
```

### Location Service
Maneja geolocalización de doctores:

```typescript
import locationService from './services/location/location.service.js';

// Actualizar ubicación
await locationService.updateDoctorLocation(doctorId, oficinaId, lat, lng);

// Obtener ubicación
const location = await locationService.getDoctorLocation(doctorId);
```

### Senescyt Validation Service
Valida títulos médicos con SENESCYT:

```typescript
import senescytService from './services/senescyt/validation.service.js';

// Validar título
const status = await senescytService.validarDoctor(
  doctorId,
  cedula,
  numeroTitulo,
  codigoUniversidad
);

// Obtener estado
const validationStatus = await senescytService.getValidationStatus(doctorId);
```

### Module Service
Módulos dinámicos por especialidad:

```typescript
import { moduleService } from './services/module/module.service.js';

// Guardar datos de módulo
await moduleService.saveModuleData({
  moduleId: 'odontograma',
  pacienteId: 'patient_123',
  datos: { dientes: { 18: { estado: 'tratado' } } }
});

// Obtener datos
const data = await moduleService.getModuleData(
  'odontograma',
  'patient_123'
);
```

## Variables de Entorno

Principales variables requeridas:

```bash
# Database
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="32-byte-base64-key"

# QR Codes
QR_SECRET="your-qr-secret-key"

# Payment Gateways
PAYPHONE_API_KEY="your-payphone-key"
KUSHKI_PUBLIC_MERCHANT_ID="your-kushki-id"

# Email (Resend)
RESEND_API_KEY="your-resend-key"
RESEND_FROM="noreply@galeno.ec"

# Jitsi Meet (Videoconferencias)
JITSI_DOMAIN="meet.jit.si"
JITSI_APP_ID="your-jitsi-app-id"
JITSI_APP_SECRET="your-jitsi-secret"
```

Ver `.env.example` para lista completa.

## Testing

```bash
# Ejecutar tests
pnpm test

# Coverage
pnpm test:coverage

# Tests unitarios
pnpm test:unit

# Tests de integración
pnpm test:integration
```

## Build

```bash
# TypeScript compilation
pnpm build

# Verificar tipos sin emitir
npx tsc --noEmit
```

## Migraciones de Base de Datos

```bash
# Crear nueva migración
pnpm prisma migrate dev --name description

# Generar Prisma Client
pnpm prisma generate

# Seed de base de datos
pnpm prisma db seed
```

## Documentación Adicional

- [Checklist para Nuevas Rutas](./docs/checklist-new-route.md)
- [Schema de Prisma](./prisma/schema.prisma)
- [API Documentation](./docs/api.md) (si existe)

## Contribución

1. Crear rama feature (`git checkout -b feature/my-feature`)
2. Hacer cambios siguiendo patrones establecidos
3. Ejecutar tests y verificar tipos
4. Commit con mensaje descriptivo
5. Push y crear Pull Request

## Licencia

Propietario - Todos los derechos reservados.
