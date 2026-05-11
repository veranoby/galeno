// apps/web/src/types/module.ts

import { Component } from 'vue';

/**
 * Especialidades médicas que pueden tener módulos personalizados
 */
export type SpecialtyModuleType =
  | 'odontologia'
  | 'oftalmologia'
  | 'pediatria'
  | 'cardiologia'
  | 'dermatologia'
  | 'traumatologia'
  | 'ginecologia'
  | 'general';

/**
 * Tipos de módulos especializados
 */
export type ModuleKind = 'chart' | 'viewer' | 'form' | 'calculator' | 'atlas';

/**
 * Configuración de un módulo de especialidad
 */
export interface ModuleConfig {
  /** Identificador único del módulo */
  id: string;
  /** Nombre del módulo */
  name: string;
  /** Descripción del módulo */
  description: string;
  /** Especialidad a la que pertenece */
  specialty: SpecialtyModuleType;
  /** Tipo de módulo */
  kind: ModuleKind;
  /** Ruta del icono (opcional) */
  icon?: string;
  /** Versión del módulo */
  version: string;
  /** Autor del módulo */
  author?: string;
  /** Etiquetas para filtrado */
  tags?: string[];
}

/**
 * Estado de carga de un módulo
 */
export type ModuleLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Información de un módulo registrado
 */
export interface RegisteredModule {
  config: ModuleConfig;
  component: Component;
  loadStatus: ModuleLoadStatus;
  error?: Error;
}

/**
 * Datos que puede proveer un módulo
 */
export interface ModuleData {
  [key: string]: unknown;
}

/**
 * Contexto que se pasa a un módulo al renderizar
 */
export interface ModuleContext {
  consultaId?: string;
  pacienteId?: string;
  readonly?: boolean;
  data?: ModuleData;
}

/**
 * Eventos que puede emitir un módulo
 */
export type ModuleEventType = 'data-changed' | 'save' | 'validate' | 'cancel';

export interface ModuleEvent {
  type: ModuleEventType;
  payload: ModuleData;
}

/**
 * Props base para componentes de módulo
 */
export interface BaseModuleProps {
  context: ModuleContext;
  emitEvent: (event: ModuleEvent) => void;
}
