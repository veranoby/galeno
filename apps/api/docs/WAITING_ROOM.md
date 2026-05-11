# Sala de Espera Virtual - Documentación

## Descripción General

La **Sala de Espera Virtual** es un sistema que permite a los pacientes esperar en una sala virtual antes de ser admitidos a la videollamada de teleconsulta. El doctor tiene control total sobre cuándo admitir, rechazar o finalizar la consulta.

## Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Paciente      │     │   Backend API    │     │    Doctor       │
│                 │     │                  │     │                 │
│  WaitingRoomView│────▶│  WaitingRoom     │◀────│ WaitingRoomPanel│
│                 │     │    Service       │     │                 │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        │
         │              ┌──────────────────┐              │
         │              │   SSE Manager    │              │
         │              │   (Redis Pub/Sub)│              │
         │              └──────────────────┘              │
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                          Notificaciones en Tiempo Real
```

## Diagrama de Estados

```
┌─────────────┐
│   WAITING   │ ◀── Paciente entra a la sala
│  (Esperando)│
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  ADMITTED   │   │   TIMEOUT   │
│  (Admitido) │   │ (Expirado)  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ IN-SESSION  │   │    ENDED    │
│ (En Sesión) │   │ (Finalizado)│
└──────┬──────┘   └─────────────┘
       │
       ▼
┌─────────────┐
│    ENDED    │
│ (Finalizado)│
└─────────────┘
```

### Transiciones Válidas

| Estado Actual | Estados Siguientes Válidos |
|--------------|---------------------------|
| `waiting` | `admitted`, `timeout`, `ended` |
| `admitted` | `in-session`, `ended` |
| `in-session` | `ended` |
| `timeout` | `ended` |
| `ended` | (ninguno - estado terminal) |

## Backend

### Servicio: `waiting-room.service.ts`

**Ubicación**: `apps/api/src/services/teleconference/waiting-room.service.ts`

#### Funciones Principales

| Función | Descripción |
|---------|-------------|
| `createWaitingRoom(data)` | Crea una nueva sala de espera para una cita |
| `getWaitingRoomStatus(citaId)` | Obtiene el estado actual de la sala |
| `admitPatient(citaId, doctorId)` | Admite al paciente (notifica vía SSE) |
| `rejectPatient(citaId, doctorId, reason?)` | Rechaza al paciente con motivo opcional |
| `startSession(citaId, doctorId)` | Inicia la sesión de consulta |
| `endSession(citaId, doctorId)` | Finaliza la sesión |
| `checkTimeout()` | Limpia salas expiradas (>15 min) |
| `validateAccess(citaId, userId, userRole)` | Valida permisos de acceso |

#### Configuración

```typescript
const DEFAULT_CONFIG = {
  timeoutMinutes: 15,           // Tiempo máximo de espera
  cleanupIntervalMinutes: 5,    // Intervalo de cleanup
  enableSSE: true,              // Habilitar notificaciones SSE
};
```

### API Routes

**Ubicación**: `apps/api/src/routes/v1/teleconsulta/waiting-room.routes.ts`

#### Endpoints

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/waiting-room` | Crear sala (paciente entra) | ✅ |
| `GET` | `/waiting-room/:citaId/status` | Obtener estado | ✅ |
| `POST` | `/waiting-room/:citaId/admit` | Admitir paciente (doctor) | ✅ |
| `POST` | `/waiting-room/:citaId/reject` | Rechazar paciente (doctor) | ✅ |
| `POST` | `/waiting-room/:citaId/start-session` | Iniciar sesión (doctor) | ✅ |
| `DELETE` | `/waiting-room/:citaId` | Terminar sesión (doctor) | ✅ |
| `GET` | `/waiting-room/:citaId/validate` | Validar acceso | ✅ |
| `GET` | `/waiting-room/doctor/active` | Salas activas del doctor | ✅ |

#### Rate Limiting

- **30 requests/minuto** por IP
- Aplicado a todos los endpoints

### Tipos

**Ubicación**: `apps/api/src/services/teleconference/waiting-room.types.ts`

```typescript
enum WaitingRoomState {
  WAITING = 'waiting',
  ADMITTED = 'admitted',
  IN_SESSION = 'in-session',
  ENDED = 'ended',
  TIMEOUT = 'timeout',
}

interface WaitingRoom {
  id: string;
  citaId: string;
  pacienteId: string;
  doctorId: string;
  estado: WaitingRoomState;
  enteredAt: Date;
  admittedAt?: Date;
  sessionStartedAt?: Date;
  endedAt?: Date;
  rejectReason?: string;
  expiresAt: Date;
  admissionAttempts: number;
}
```

## Frontend

### Composable: `useWaitingRoom.ts`

**Ubicación**: `apps/web/src/composables/useWaitingRoom.ts`

#### Uso

```typescript
import { useWaitingRoom } from '@/composables/useWaitingRoom';

const {
  status,
  waitingRoom,
  error,
  isLoading,
  isAdmitted,
  isWaiting,
  isEnded,
  timeRemaining,
  timeElapsed,
  joinWaitingRoom,
  fetchStatus,
  admitPatient,
  rejectPatient,
  startSession,
  endSession,
  initializeSSE,
  startPolling,
} = useWaitingRoom({
  userId: 'user-123',
  userRole: 'paciente', // o 'doctor'
  autoReconnect: true,
  pollingInterval: 3000,
});
```

#### Métodos Públicos

| Método | Parámetros | Retorna | Descripción |
|--------|-----------|---------|-------------|
| `joinWaitingRoom` | `citaId: string` | `Promise<WaitingRoom>` | Paciente entra a sala |
| `fetchStatus` | `citaId: string` | `Promise<WaitingRoomStatus>` | Obtiene estado actual |
| `validateAccess` | `citaId: string` | `Promise<AccessValidation>` | Valida permisos |
| `admitPatient` | `citaId: string` | `Promise<WaitingRoom>` | Doctor admite |
| `rejectPatient` | `citaId, reason?` | `Promise<WaitingRoom>` | Doctor rechaza |
| `startSession` | `citaId: string` | `Promise<WaitingRoom>` | Inicia sesión |
| `endSession` | `citaId: string` | `Promise<WaitingRoom>` | Termina sesión |

### Vista Paciente: `WaitingRoomView.vue`

**Ubicación**: `apps/web/src/views/teleconference/WaitingRoomView.vue`

#### Características

- ✅ UI de espera con animación de pulso
- ✅ Timer de cuenta regresiva (15 min)
- ✅ Tiempo de espera transcurrido
- ✅ Estado de conexión (conectando, conectado, error)
- ✅ Botón "Cancelar espera"
- ✅ Notificaciones toast
- ✅ Auto-redirección al ser admitido
- ✅ Manejo de timeout
- ✅ Accesibilidad (ARIA live regions)

#### Ruta

```
/teleconsulta/:citaId/waiting-room
```

### Panel Doctor: `WaitingRoomPanel.vue`

**Ubicación**: `apps/web/src/components/teleconsulta/WaitingRoomPanel.vue`

#### Características

- ✅ Lista de pacientes esperando
- ✅ Notificación cuando paciente entra
- ✅ Botones: Admitir, Rechazar, Iniciar, Finalizar
- ✅ Información: nombre, tiempo esperando, tiempo restante
- ✅ Modal de rechazo con motivo
- ✅ Badge de pacientes esperando
- ✅ Polling automático (5s)
- ✅ Notificaciones SSE en tiempo real

#### Uso en Vista de Consulta

```vue
<template>
  <div class="consulta-workspace">
    <WaitingRoomPanel />
    <!-- Resto de la vista -->
  </div>
</template>

<script setup>
import WaitingRoomPanel from '@/components/teleconsulta/WaitingRoomPanel.vue';
</script>
```

### Componente JitsiMeet Actualizado

**Ubicación**: `apps/web/src/components/teleconsulta/JitsiMeet.vue`

#### Nuevas Props

```typescript
interface Props {
  // ... existing props
  waitingRoomEnabled: boolean;      // Habilitar sala de espera
  waitingRoomStatus?: string;       // Estado actual
}
```

#### Nuevos Eventos

```typescript
emit('waiting-room-admitted');  // Cuando el doctor admite
```

#### Comportamiento

- Si `waitingRoomEnabled=true`, no inicia la videollamada hasta ser admitido
- Muestra UI de espera mientras está en estado `waiting`
- Auto-inicia cuando recibe evento de admisión

## Flujo de Uso

### Paciente

```
1. Paciente hace clic en "Unirse a consulta"
2. Navega a /teleconsulta/:citaId/waiting-room
3. Se crea sala de espera (POST /waiting-room)
4. Ve UI de espera con timer
5. Escucha eventos SSE
6. Cuando es admitido → redirige a videollamada
7. Si timeout → muestra mensaje y opción de reprogramar
```

### Doctor

```
1. Doctor abre vista de consulta
2. Ve WaitingRoomPanel con lista de pacientes
3. Recibe notificación cuando paciente entra (SSE)
4. Click en "Admitir" → paciente entra a videollamada
5. Click en "Iniciar" → inicia sesión正式
6. Click en "Finalizar" → termina consulta
```

## Notificaciones SSE

### Eventos

| Evento | Payload | Destinatario |
|--------|---------|--------------|
| `WAITING_ROOM_UPDATE` | `{ citaId, estado, timestamp }` | Doctor |
| `WAITING_ROOM_ADMITTED` | `{ citaId, estado, timestamp }` | Paciente |
| `WAITING_ROOM_REJECTED` | `{ citaId, estado, timestamp, motivo? }` | Paciente |
| `WAITING_ROOM_TIMEOUT` | `{ citaId, estado, timestamp }` | Paciente |

### Escuchar Eventos

```typescript
// En componente Vue
onMounted(() => {
  window.addEventListener('waiting-room-admitted', (e) => {
    console.log('¡Fuiste admitido!', e.detail);
  });
  
  window.addEventListener('waiting-room-rejected', (e) => {
    console.log('Solicitud rechazada:', e.detail.motivo);
  });
});
```

## Timeout y Cleanup

### Configuración

- **Timeout**: 15 minutos desde que el paciente entra
- **Cleanup**: Cada 5 minutos verifica salas expiradas

### Comportamiento

1. Cuando paciente entra → `expiresAt = now + 15min`
2. Cleanup verifica cada 5 min
3. Si `now > expiresAt` → estado cambia a `timeout`
4. Notifica al paciente vía SSE
5. Actualiza cita a `no_presento`

## Seguridad

### Autenticación

- ✅ Todas las rutas requieren auth middleware
- ✅ Validación de userId vs token
- ✅ Verificación de permisos por cita

### Autorización

- ✅ Solo paciente puede crear sala para SU cita
- ✅ Solo doctor puede admitir/rechazar para SU cita
- ✅ Admin tiene acceso total

### Rate Limiting

- 30 requests/minuto por IP
- Previene abuso del sistema

## Auditoría

### Eventos Registrados

| Evento | Datos |
|--------|-------|
| `waiting_room_created` | userId, citaId, expiresAt |
| `patient_admitted` | doctorId, citaId, pacienteId |
| `patient_rejected` | doctorId, citaId, pacienteId, reason |
| `session_started` | doctorId, citaId, pacienteId |
| `session_ended` | doctorId, citaId, pacienteId |

## Consideraciones de Producción

### Redis

- Requerido para SSE multi-instancia
- Canal: `notifications`
- Config: `REDIS_URL` env var

### Cleanup en Producción

```typescript
// El servicio inicia cleanup automático al inicializar
await waitingRoomService.initialize();

// Graceful shutdown
await waitingRoomService.shutdown();
```

### Monitoreo

```typescript
// Obtener estadísticas
const stats = waitingRoomService.getStats();
// { stats: { waiting: 5, admitted: 2, ... }, total: 10 }
```

## Testing

### Manual

1. **Flujo normal**: Paciente entra → Doctor admite → Videollamada
2. **Timeout**: Esperar 15 min → Verificar estado timeout
3. **Rechazo**: Doctor rechaza → Verificar notificación paciente
4. **SSE**: Abrir dos ventanas → Verificar notificaciones en tiempo real

### Casos Borde

- [ ] Paciente entra antes de hora de cita
- [ ] Doctor no está disponible
- [ ] Múltiples pacientes para mismo doctor
- [ ] Reconexión SSE después de pérdida de red
- [ ] Cleanup después de restart del servidor

## Archivos Creados/Modificados

### Backend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `waiting-room.types.ts` | Creado | Tipos e interfaces |
| `waiting-room.service.ts` | Creado | Lógica de negocio |
| `waiting-room.routes.ts` | Creado | Endpoints API |
| `teleconsulta.routes.ts` | Modificado | Mount waiting-room routes |

### Frontend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `useWaitingRoom.ts` | Creado | Composable Vue |
| `WaitingRoomView.vue` | Creado | Vista paciente |
| `WaitingRoomPanel.vue` | Creado | Panel doctor |
| `JitsiMeet.vue` | Modificado | Props waiting room |
| `router/index.ts` | Modificado | Rutas waiting room |

## Próximos Pasos

- [ ] Integrar con vista de Agenda
- [ ] Sonido de notificación para doctor
- [ ] Persistencia en Redis/DB para recovery
- [ ] Métricas de tiempo promedio de espera
- [ ] Plantillas de mensajes de rechazo
- [ ] Configuración de timeout por doctor
