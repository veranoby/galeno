/**
 * Offline Interceptor para apiClient
 * Intercepta requests y responses para manejar modo offline
 * 
 * - Requests: Si está offline, encola la operación
 * - Responses: Si falla por network, guarda en cola para reintento
 */

import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { indexedDBService } from './indexeddb';
import { operationQueue } from './queue';
import type { QueuedOperation, OperationType } from './types';
import { syncManager } from './sync-manager';

// Métodos HTTP que modifican datos
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// Endpoints que deben ser encolados offline
const OFFLINE_AWARE_ENDPOINTS = [
  '/pacientes',
  '/consultas',
  '/documentos',
  '/agenda',
  '/citas',
  '/interconsultas'
];

/**
 * Verifica si el endpoint es offline-aware
 */
function isOfflineAwareEndpoint(url: string): boolean {
  return OFFLINE_AWARE_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

/**
 * Extrae el tipo de recurso del endpoint
 */
function extractResourceType(url: string): string {
  const match = url.match(/\/(pacientes|consultas|documentos|agenda|citas|interconsultas)/);
  return match ? match[1] : 'unknown';
}

/**
 * Extrae el entityId de la URL o del payload
 * Intenta obtener el ID de:
 * 1. URL params (ej: /pacientes/123)
 * 2. Payload data.id
 * 3. Payload data._id
 * 4. Genera un temporal ID
 */
function extractEntityId(url: string, data?: any): string {
  // Intentar extraer de la URL (ej: /pacientes/123 -> 123)
  const urlMatch = url.match(/\/[a-zA-Z]+\/([a-f0-9-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Intentar extraer del payload
  if (data) {
    if (data.id) return data.id;
    if (data._id) return data._id;
    if (data.pacienteId) return data.pacienteId;
    if (data.consultaId) return data.consultaId;
  }

  // Generar ID temporal único
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Mapea método HTTP a tipo de operación
 */
function mapMethodToOperationType(method: string): OperationType {
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'DELETE') return 'DELETE';
  if (upperMethod === 'POST') return 'CREATE';
  return 'UPDATE';
}

/**
 * Request Interceptor - Maneja requests cuando está offline
 */
export async function offlineRequestInterceptor(
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> {
  // Solo interceptar métodos mutating
  if (!config.method || !MUTATING_METHODS.includes(config.method.toLowerCase())) {
    return config;
  }

  // Verificar si el endpoint es offline-aware
  if (!isOfflineAwareEndpoint(config.url || '')) {
    return config;
  }

  // Si está online, dejar pasar el request normalmente
  if (navigator.onLine) {
    return config;
  }

  // Está offline - encolar la operación
  console.log('[Offline Interceptor] Offline detected - queueing operation:', config.url);

  try {
    const resourceType = extractResourceType(config.url || '');
    // Extraer entityId de la URL o del payload
    const entityId = extractEntityId(config.url || '', config.data);

    const operation = await operationQueue.enqueue(
      resourceType,
      entityId,
      mapMethodToOperationType(config.method || 'GET'),
      { payload: config.data }
    );
    
    // Emitir evento de operación encolada
    (syncManager as any).emit('operation-queued', {
      operation,
      pendingCount: await operationQueue.getCount()
    });

    // Throw error para que el response interceptor lo maneje
    const offlineError = new Error('Offline - operation queued') as AxiosError;
    (offlineError as any).isAxiosError = true;
    (offlineError as any).response = {
      status: 0,
      statusText: 'Offline',
      data: { offline: true, queued: true },
      headers: {},
      config
    };
    
    throw offlineError;
  } catch (error) {
    console.error('[Offline Interceptor] Error queueing operation:', error);
    throw error;
  }
}

/**
 * Response Interceptor - Maneja responses
 */
export async function offlineResponseInterceptor(
  response: any
): Promise<any> {
  // Response normal - dejar pasar
  return response;
}

/**
 * Response Error Interceptor - Maneja errores de red
 */
export async function offlineResponseErrorInterceptor(
  error: AxiosError
): Promise<never> {
  const config = error.config as InternalAxiosRequestConfig;
  
  // Verificar si es error de network
  const isNetworkError = !error.response || error.response.status === 0;
  
  // Verificar si es método mutating y endpoint offline-aware
  const isMutating = config?.method && MUTATING_METHODS.includes(config.method.toLowerCase());
  const isOfflineAware = config?.url && isOfflineAwareEndpoint(config.url);
  
  // Si no es error de red o no es mutating, propagar error
  if (!isNetworkError || !isMutating || !isOfflineAware) {
    throw error;
  }

  // Verificar si ya está encolada esta operación
  const allOperations = await operationQueue.getAll();

  const resourceType = extractResourceType(config.url || '');
  const entityId = extractEntityId(config.url || '', config?.data);
  const operationType = mapMethodToOperationType(config.method || 'GET');
  
  const alreadyQueued = allOperations.some((op) =>
    op.entityName === resourceType &&
    op.entityId === entityId &&
    op.type === operationType
  );

  if (alreadyQueued) {
    console.log('[Offline Interceptor] Operation already queued:', config.url);
    throw error;
  }

  // Encolar operación para reintento
  console.log('[Offline Interceptor] Network error - queueing for retry:', config.url);

  try {
    const resourceType = extractResourceType(config.url || '');
    const entityId = extractEntityId(config.url || '', config?.data);
    const operation = await operationQueue.enqueue(
      resourceType,
      entityId,
      mapMethodToOperationType(config.method || 'GET'),
      { payload: config.data }
    );
    
    (syncManager as any).emit('operation-queued', {
      operation,
      pendingCount: await operationQueue.getCount()
    });
    
    // Retornar respuesta offline exitosa
    return Promise.resolve({
      data: {
        offline: true,
        queued: true,
        message: 'Operation queued for sync when online'
      },
      status: 202,
      statusText: 'Accepted (Offline)',
      headers: {},
      config
    }) as never;
  } catch (queueError) {
    console.error('[Offline Interceptor] Error queueing operation:', queueError);
    throw error;
  }
}

/**
 * Configurar interceptores en el apiClient
 */
export function setupOfflineInterceptors(apiClient: any): void {
  apiClient.interceptors.request.use(
    offlineRequestInterceptor,
    (error: any) => Promise.reject(error)
  );
  
  apiClient.interceptors.response.use(
    offlineResponseInterceptor,
    offlineResponseErrorInterceptor
  );
  
  console.log('[Offline Interceptor] Interceptors configured');
}
