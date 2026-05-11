# Offline-First Module - Galeno

Módulo completo para soporte offline-first con IndexedDB, sincronización automática y resolución de conflictos.

## 📦 Características

- ✅ **IndexedDB** con Dexie.js para almacenamiento local
- ✅ **Sincronización automática** al recuperar conexión
- ✅ **Last Write Wins (LWW)** para resolución de conflictos
- ✅ **Cola de operaciones** con reintentos y backoff exponencial
- ✅ **Detección online/offline** en tiempo real
- ✅ **Interceptors** para apiClient
- ✅ **Composable Vue 3** reactivo

## 🚀 Instalación

```bash
pnpm add dexie axios
```

## 📁 Estructura

```
src/services/offline/
├── types.ts                  # Tipos TypeScript
├── indexeddb.ts              # Dexie database + CRUD operations
├── queue.ts                  # Cola de operaciones pendientes
├── lww-strategy.ts           # Last Write Wins implementation
├── sync-manager.ts           # Orquestador de sincronización
├── interceptor.ts            # Axios interceptors
├── setup.ts                  # Inicialización del módulo
├── index.ts                  # Export principal
└── __tests__/
    ├── lww-strategy.test.ts  # 22 tests LWW
    └── sync-manager.test.ts  # 13 tests SyncManager
```

## 🔧 Uso Básico

### 1. Inicialización (automática en main.ts)

```typescript
import { setupOfflineMode } from '@/services/offline/setup';

// En main.ts
setupOfflineMode().catch(err => {
  console.error('[Main] Offline mode setup failed:', err);
});
```

### 2. Composable en Componentes Vue

```vue
<script setup lang="ts">
import { useOffline } from '@/composables/useOffline';

const { 
  isOffline,      // Ref<boolean>
  isSyncing,      // Ref<boolean>
  pendingCount,   // Ref<number>
  syncProgress,   // Ref<SyncProgress>
  sync            // Function
} = useOffline();
</script>

<template>
  <!-- Banner offline -->
  <div v-if="isOffline" class="offline-banner">
    <v-icon>mdi-wifi-off</v-icon>
    Modo offline - {{ pendingCount }} cambios pendientes
  </div>
  
  <!-- Botón de sincronización -->
  <v-btn 
    :loading="isSyncing" 
    :disabled="isOffline"
    @click="sync"
  >
    Sincronizar ({{ syncProgress.percentage }}%)
  </v-btn>
</template>
```

### 3. Obtener Estado

```typescript
import { getOfflineStatus } from '@/services/offline/setup';

const status = await getOfflineStatus();
console.log(status);
// {
//   isOnline: true,
//   isSyncing: false,
//   pendingCount: 5,
//   lastSync: new Date('2026-02-17T15:00:00Z')
// }
```

## 📊 Tipos Principales

### OfflineEntity

```typescript
interface OfflineEntity {
  id: string;
  createdAt: number;
  lastModified: number;
  syncedAt: number | null;
  version: number;
  syncStatus: SyncStatus; // 'SYNCED' | 'PENDING' | 'CONFLICT' | 'FAILED' | 'QUEUED'
  tempId?: string;
}
```

### QueuedOperation

```typescript
interface QueuedOperation {
  id: string;
  type: OperationType; // 'CREATE' | 'UPDATE' | 'DELETE'
  entityName: string; // 'pacientes', 'consultas', etc.
  entityId: string;
  payload: Record<string, unknown> | null;
  createdAt: number;
  retryCount: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  priority: number;
}
```

## 🔄 Flujo de Sincronización

```
┌─────────────┐
│  Usuario    │
│  Crea/      │
│  Edita      │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  apiClient      │◄─── Interceptor detecta offline
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  OperationQueue │───► IndexedDB (persistencia)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  SyncManager    │◄─── Detecta online
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  LWW Strategy   │◄─── Resuelve conflictos
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  API Server     │───► Sync exitosa
└─────────────────┘
```

## 🎯 Estrategia LWW (Last Write Wins)

Cada entidad tiene:
- `timestamp`: Cuándo se modificó
- `version`: Número de versión incremental

**Reglas:**
1. Si `client.timestamp > server.timestamp` → Client wins
2. Si `server.timestamp > client.timestamp` → Server wins
3. Si iguales → Merge campo por campo

```typescript
import { lww } from '@/services/offline';

const result = lww.resolve({
  client: { id: '1', nombre: 'Juan', lastModified: 1000 },
  server: { id: '1', nombre: 'José', lastModified: 900 }
});

console.log(result.winner); // Client
console.log(result.resolved); // { id: '1', nombre: 'Juan', ... }
```

## ⚙️ Configuración

```typescript
import { DEFAULT_OFFLINE_CONFIG } from '@/services/offline/types';

console.log(DEFAULT_OFFLINE_CONFIG);
// {
//   maxQueueSize: 1000,
//   maxRetries: 3,
//   backoffMultiplier: 2,
//   initialBackoffMs: 1000,
//   maxBackoffMs: 300000,
//   syncBatchSize: 50,
//   ...
// }
```

## 🧪 Testing

```bash
# Tests unitarios
pnpm test src/services/offline/__tests__/*.test.ts

# Coverage
pnpm test:coverage --include='src/services/offline/**'
```

## 📝 Endpoints Offline-Aware

Los siguientes endpoints se encolan automáticamente cuando está offline:

- `/pacientes`
- `/consultas`
- `/documentos`
- `/agenda`
- `/citas`
- `/interconsultas`

## ⚠️ Consideraciones

### Cuota de IndexedDB

- Límite típico: 50-80% del disco disponible
- LRU eviction automático cuando excede `maxStorageMB`
- Usar `indexedDBService.exportAll()` para backup

### Conflictos

- Conflictos se resuelven automáticamente con LWW
- Para merge manual, usar estrategia `MANUAL`
- Eventos `conflict-detected` para notificaciones UI

### Performance

- Batch sync con `syncBatchSize` operaciones
- Lazy loading para grandes volúmenes de datos
- Índices en IndexedDB para búsquedas rápidas

## 🔗 Recursos

- [Dexie.js Documentation](https://dexie.org/)
- [IndexedDB MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Offline-First Architecture](https://web.dev/offline-cookbook/)

---

**Implementado:** 2026-02-17  
**Versión:** 1.0.0  
**Tests:** 35/35 passing ✅
