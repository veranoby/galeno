// apps/web/src/state/managers/ConsultaStateManager.ts
/**
 * ConsultaStateManager - Gestión centralizada del estado de consultas
 *
 * Responsabilidades:
 * - Cache de consultas activas
 * - Sincronización con backend
 * - Estado de firmas pendientes
 * - Cola de consultas offline
 *
 * Patrones aplicados:
 * - Singleton: Una instancia única
 * - Cache: Reducir llamadas API
 * - Sync Queue: Sincronización offline/online
 */

import { ref, computed, watch, type Ref } from 'vue';

// ============= TYPES =============

export interface ConsultaState {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  doctorId: string;
  estado: 'pendiente' | 'en_atencion' | 'finalizada' | 'borrador';
  tipo: 'presencial' | 'teleconsulta';
  motivo: string;
  createdAt: Date;
  updatedAt: Date;
  firmada?: boolean;
  firmadaPor?: string;
  firmadaAt?: Date;
}

export interface ConsultaFilters {
  estado?: ConsultaState['estado'];
  tipo?: ConsultaState['tipo'];
  pacienteId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

// ============= STATE MANAGER =============

class ConsultaStateManagerClass {
  // Estado privado reactivo
  private _consultas: Ref<Map<string, ConsultaState>>;
  private _consultaActiva: Ref<ConsultaState | null>;
  private _isLoading: Ref<boolean>;
  private _error: Ref<Error | null>;

  // Cola de sincronización offline
  private syncQueue: Array<(isOnline: boolean) => Promise<void>> = [];

  // Suscriptores
  private subscribers: Set<(consultas: ConsultaState[]) => void> = new Set();

  // Handlers para cleanup de event listeners (OPTIMIZACIÓN)
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor() {
    this._consultas = ref(new Map());
    this._consultaActiva = ref(null);
    this._isLoading = ref(false);
    this._error = ref(null);

    // Watch para persistir cambios (con debouncing para OPTIMIZACIÓN)
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    watch(
      this._consultas,
      (consultas) => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.saveToStorage(Array.from(consultas.values()));
        }, 500); // Debounce 500ms
      },
      { deep: true }
    );

    // Cargar desde localStorage
    this.loadFromStorage();

    // Escuchar eventos de online/offline (con bound methods para cleanup)
    this.onlineHandler = () => this.handleOnline();
    this.offlineHandler = () => this.handleOffline();
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  // ============= PUBLIC API =============

  /**
   * Lista de todas las consultas
   */
  get consultas(): ConsultaState[] {
    return Array.from(this._consultas.value.values());
  }

  /**
   * Consulta activa actualmente
   */
  get consultaActiva(): ConsultaState | null {
    return this._consultaActiva.value;
  }

  /**
   * Estado de carga
   */
  get isLoading(): boolean {
    return this._isLoading.value;
  }

  /**
   * Error actual
   */
  get error(): Error | null {
    return this._error.value;
  }

  /**
   * Consultas por estado
   */
  get pendientes(): ConsultaState[] {
    return this.consultas.filter(c => c.estado === 'pendiente');
  }

  get enAtencion(): ConsultaState[] {
    return this.consultas.filter(c => c.estado === 'en_atencion');
  }

  get finalizadas(): ConsultaState[] {
    return this.consultas.filter(c => c.estado === 'finalizada');
  }

  get borradores(): ConsultaState[] {
    return this.consultas.filter(c => c.estado === 'borrador');
  }

  get firmadas(): ConsultaState[] {
    return this.consultas.filter(c => c.firmada);
  }

  /**
   * Obtener consulta por ID
   */
  getConsultaById(id: string): ConsultaState | undefined {
    return this._consultas.value.get(id);
  }

  /**
   * Cargar consultas desde el servidor
   */
  async loadConsultas(filters?: ConsultaFilters): Promise<void> {
    this._isLoading.value = true;
    this._error.value = null;

    try {
      // Aquí se haría la llamada real a la API
      // const response = await api.get('/consultas', { params: filters });
      // const consultas = response.data;

      // Simulación por ahora
      await new Promise(resolve => setTimeout(resolve, 500));

      // Actualizar cache
      // consultas.forEach(consulta => {
      //   this._consultas.value.set(consulta.id, {
      //     ...consulta,
      //     createdAt: new Date(consulta.createdAt),
      //     updatedAt: new Date(consulta.updatedAt)
      //   });
      // });

      this.notifySubscribers();
    } catch (error) {
      this._error.value = error as Error;
      throw error;
    } finally {
      this._isLoading.value = false;
    }
  }

  /**
   * Establecer consulta activa
   */
  setConsultaActiva(consulta: ConsultaState | null): void {
    this._consultaActiva.value = consulta;
  }

  /**
   * Crear nueva consulta
   */
  async createConsulta(data: Omit<ConsultaState, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConsultaState> {
    const newConsulta: ConsultaState = {
      ...data,
      id: `consulta_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Agregar al estado local inmediatamente (optimistic update)
    this._consultas.value.set(newConsulta.id, newConsulta);

    // Agregar a cola de sincronización si está offline
    if (!navigator.onLine) {
      this.syncQueue.push(async () => {
        // Sincronizar con servidor cuando esté online
        await this.syncConsulta(newConsulta);
      });
    } else {
      // Sincronizar inmediatamente
      await this.syncConsulta(newConsulta);
    }

    this.notifySubscribers();
    return newConsulta;
  }

  /**
   * Actualizar consulta
   */
  async updateConsulta(id: string, updates: Partial<ConsultaState>): Promise<void> {
    const consulta = this._consultas.value.get(id);
    if (!consulta) {
      throw new Error(`Consulta ${id} no encontrada`);
    }

    const updated: ConsultaState = {
      ...consulta,
      ...updates,
      updatedAt: new Date()
    };

    this._consultas.value.set(id, updated);

    // Sincronizar con servidor
    if (!navigator.onLine) {
      this.syncQueue.push(async () => {
        await this.syncConsultaUpdate(id, updates);
      });
    } else {
      await this.syncConsultaUpdate(id, updates);
    }

    this.notifySubscribers();
  }

  /**
   * Marcar consulta como firmada
   */
  async marcarFirmada(id: string, firmadaPor: string): Promise<void> {
    await this.updateConsulta(id, {
      firmada: true,
      firmadaPor,
      firmadaAt: new Date(),
      estado: 'finalizada'
    });
  }

  /**
   * Filtrar consultas
   */
  filtrarConsultas(filters: ConsultaFilters): ConsultaState[] {
    let filtradas = this.consultas;

    if (filters.estado) {
      filtradas = filtradas.filter(c => c.estado === filters.estado);
    }

    if (filters.tipo) {
      filtradas = filtradas.filter(c => c.tipo === filters.tipo);
    }

    if (filters.pacienteId) {
      filtradas = filtradas.filter(c => c.pacienteId === filters.pacienteId);
    }

    if (filters.fechaDesde) {
      filtradas = filtradas.filter(c => c.createdAt >= filters.fechaDesde!);
    }

    if (filters.fechaHasta) {
      filtradas = filtradas.filter(c => c.createdAt <= filters.fechaHasta!);
    }

    return filtradas;
  }

  /**
   * Suscribirse a cambios
   */
  subscribe(callback: (consultas: ConsultaState[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Limpiar todas las consultas
   */
  clearAll(): void {
    this._consultas.value.clear();
    this._consultaActiva.value = null;
    this.notifySubscribers();
  }

  /**
   * Limpia recursos (para prevenir memory leaks)
   *
   * OPTIMIZACIÓN: Cleanup de event listeners y suscriptores
   */
  destroy(): void {
    // Remover event listeners (previene memory leaks)
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);

    // Limpiar suscriptores
    this.subscribers.clear();

    // Limpiar cola de sincronización
    this.syncQueue = [];
  }

  // ============= PRIVATE METHODS =============

  private async syncConsulta(consulta: ConsultaState): Promise<void> {
    try {
      // Aquí se haría la llamada real a la API
      // await api.post('/consultas', consulta);
      console.log('[ConsultaSync] Consulta sincronizada:', consulta.id);
    } catch (error) {
      console.error('[ConsultaSync] Error sincronizando consulta:', error);
      throw error;
    }
  }

  private async syncConsultaUpdate(id: string, updates: Partial<ConsultaState>): Promise<void> {
    try {
      // Aquí se haría la llamada real a la API
      // await api.patch(`/consultas/${id}`, updates);
      console.log('[ConsultaSync] Consulta actualizada:', id);
    } catch (error) {
      console.error('[ConsultaSync] Error actualizando consulta:', error);
      throw error;
    }
  }

  private handleOnline(): void {
    console.log('[ConsultaStateManager] Online, procesando cola de sincronización');

    // Procesar cola de sincronización
    Promise.allSettled(
      this.syncQueue.map(fn => fn(true))
    ).then(() => {
      this.syncQueue = [];
    });
  }

  private handleOffline(): void {
    console.log('[ConsultaStateManager] Offline, cambios se sincronizarán al reconectar');
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.consultas);
      } catch (error) {
        console.error('Error en suscriptor de consultas:', error);
      }
    });
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('galeno_consultas');
      if (!saved) return;

      const parsed = JSON.parse(saved);
      const consultas = parsed.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      }));

      consultas.forEach((consulta: ConsultaState) => {
        this._consultas.value.set(consulta.id, consulta);
      });
    } catch (error) {
      console.error('Error cargando consultas desde storage:', error);
    }
  }

  private saveToStorage(consultas: ConsultaState[]): void {
    try {
      localStorage.setItem('galeno_consultas', JSON.stringify(consultas));
    } catch (error) {
      console.error('Error guardando consultas en storage:', error);
    }
  }
}

// ============= SINGLETON =============

export const ConsultaStateManager = new ConsultaStateManagerClass();

// ============= COMPOSABLE PARA VUE =============

/**
 * Composable para usar el ConsultaStateManager en componentes Vue 3
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useConsultaManager } from '@/state/managers/ConsultaStateManager'
 *
 * const {
 *   consultas,
 *   consultaActiva,
 *   pendientes,
 *   loadConsultas,
 *   setConsultaActiva,
 *   marcarFirmada
 * } = useConsultaManager()
 *
 * onMounted(() => {
 *   loadConsultas()
 * })
 * </script>
 * ```
 */
export function useConsultaManager() {
  return {
    // Estado
    consultas: ConsultaStateManager.consultas,
    consultaActiva: ConsultaStateManager.consultaActiva,
    isLoading: ConsultaStateManager.isLoading,
    error: ConsultaStateManager.error,
    pendientes: ConsultaStateManager.pendientes,
    enAtencion: ConsultaStateManager.enAtencion,
    finalizadas: ConsultaStateManager.finalizadas,
    borradores: ConsultaStateManager.borradores,
    firmadas: ConsultaStateManager.firmadas,

    // Métodos
    loadConsultas: (filters?: Parameters<typeof ConsultaStateManager.loadConsultas>[0]) =>
      ConsultaStateManager.loadConsultas(filters),

    getConsultaById: (id: string) =>
      ConsultaStateManager.getConsultaById(id),

    setConsultaActiva: (consulta: Parameters<typeof ConsultaStateManager.setConsultaActiva>[0]) =>
      ConsultaStateManager.setConsultaActiva(consulta),

    createConsulta: (data: Parameters<typeof ConsultaStateManager.createConsulta>[0]) =>
      ConsultaStateManager.createConsulta(data),

    updateConsulta: (id: string, updates: Parameters<typeof ConsultaStateManager.updateConsulta>[1]) =>
      ConsultaStateManager.updateConsulta(id, updates),

    marcarFirmada: (id: string, firmadoPor: string) =>
      ConsultaStateManager.marcarFirmada(id, firmadoPor),

    filtrarConsultas: (filters: Parameters<typeof ConsultaStateManager.filtrarConsultas>[0]) =>
      ConsultaStateManager.filtrarConsultas(filters),

    subscribe: (callback: Parameters<typeof ConsultaStateManager.subscribe>[0]) =>
      ConsultaStateManager.subscribe(callback),

    clearAll: () =>
      ConsultaStateManager.clearAll()
  };
}

export default ConsultaStateManager;
