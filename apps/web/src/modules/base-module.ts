// apps/web/src/modules/base-module.ts

import type { ModuleConfig, ModuleContext, ModuleData, ModuleEvent } from '@/types/module';

/**
 * Clase base para todos los módulos de especialidad
 * Proporciona funcionalidad común para gestión de datos, validación y eventos
 */
export abstract class BaseSpecialtyModule {
  protected readonly config: ModuleConfig;
  protected context: ModuleContext;
  protected internalData: ModuleData;
  protected eventHandlers: Map<string, ((event: ModuleEvent) => void)[]> = new Map();
  protected validationErrors: Map<string, string> = new Map();

  constructor(config: ModuleConfig, context: ModuleContext) {
    this.config = config;
    this.context = context;
    this.internalData = { ...context.data };
  }

  /**
   * Obtiene la configuración del módulo
   */
  getConfig(): ModuleConfig {
    return this.config;
  }

  /**
   * Actualiza el contexto del módulo
   */
  setContext(context: ModuleContext): void {
    this.context = context;
  }

  /**
   * Obtiene los datos actuales del módulo
   */
  getData(): ModuleData {
    return { ...this.internalData };
  }

  /**
   * Actualiza un dato específico del módulo
   */
  setData(key: string, value: unknown): void {
    const oldValue = this.internalData[key];
    this.internalData[key] = value;

    // Emitir evento de cambio de datos
    this.emit('data-changed', { key, value, oldValue });
  }

  /**
   * Establece múltiples datos a la vez
   */
  setBatchData(data: ModuleData): void {
    Object.assign(this.internalData, data);
    this.emit('data-changed', { ...data });
  }

  /**
   * Registra un handler para eventos del módulo
   */
  on(eventType: string, handler: (event: ModuleEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)?.push(handler);
  }

  /**
   * Elimina un handler de eventos
   */
  off(eventType: string, handler: (event: ModuleEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emite un evento
   */
  protected emit(eventType: string, payload: ModuleData): void {
    const event: ModuleEvent = { type: eventType as ModuleEvent['type'], payload };
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  /**
   * Valida los datos del módulo
   * Debe ser implementado por cada módulo específico
   */
  abstract validate(): Promise<boolean>;

  /**
   * Guarda los datos del módulo
   */
  async save(): Promise<boolean> {
    this.emit('save', this.getData());
    return true;
  }

  /**
   * Cancela los cambios y restaura el estado inicial
   */
  cancel(): void {
    this.internalData = { ...this.context.data };
    this.emit('cancel', {});
  }

  /**
   * Limpia los recursos del módulo
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.validationErrors.clear();
  }

  /**
   * Obtiene los errores de validación
   */
  getValidationErrors(): Map<string, string> {
    return new Map(this.validationErrors);
  }

  /**
   * Agrega un error de validación
   */
  protected addValidationError(field: string, message: string): void {
    this.validationErrors.set(field, message);
  }

  /**
   * Limpia todos los errores de validación
   */
  protected clearValidationErrors(): void {
    this.validationErrors.clear();
  }
}

/**
 * Factory para crear instancias de módulos
 */
export type ModuleFactory = (context: ModuleContext) => BaseSpecialtyModule;
