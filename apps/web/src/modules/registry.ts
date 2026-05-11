// apps/web/src/modules/registry.ts

import { defineAsyncComponent, type Component } from 'vue';
import type { ModuleConfig, ModuleContext, RegisteredModule, SpecialtyModuleType } from '@/types/module';
import type { ModuleFactory } from './base-module';

/**
 * Registro global de módulos de especialidad
 * Permite registrar, cargar y obtener módulos dinámicamente
 */
class ModuleRegistry {
  private modules: Map<string, RegisteredModule> = new Map();
  private modulesBySpecialty: Map<SpecialtyModuleType, Set<string>> = new Map();

  /**
   * Registra un nuevo módulo en el sistema
   */
  register(config: ModuleConfig, component: Component): void {
    const module: RegisteredModule = {
      config,
      component,
      loadStatus: 'idle'
    };

    this.modules.set(config.id, module);

    // Indexar por especialidad
    if (!this.modulesBySpecialty.has(config.specialty)) {
      this.modulesBySpecialty.set(config.specialty, new Set());
    }
    this.modulesBySpecialty.get(config.specialty)?.add(config.id);

    console.info(`[ModuleRegistry] Module registered: ${config.id}`);
  }

  /**
   * Registra un módulo asíncrono (lazy loading)
   */
  registerAsync(config: ModuleConfig, loader: () => Promise<{ default: Component }>): void {
    const asyncComponent = defineAsyncComponent({
      loader,
      loadingComponent: () => null,
      errorComponent: () => null,
      delay: 200,
      timeout: 10000
    });

    this.register(config, asyncComponent);
  }

  /**
   * Obtiene un módulo por su ID
   */
  getModule(id: string): RegisteredModule | undefined {
    return this.modules.get(id);
  }

  /**
   * Obtiene el componente de un módulo
   */
  getComponent(id: string): Component | undefined {
    return this.modules.get(id)?.component;
  }

  /**
   * Obtiene todos los módulos de una especialidad
   */
  getModulesBySpecialty(specialty: SpecialtyModuleType): RegisteredModule[] {
    const moduleIds = this.modulesBySpecialty.get(specialty);
    if (!moduleIds) return [];

    return Array.from(moduleIds)
      .map(id => this.modules.get(id))
      .filter((module): module is RegisteredModule => module !== undefined);
  }

  /**
   * Obtiene todos los módulos registrados
   */
  getAllModules(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Verifica si un módulo está registrado
   */
  hasModule(id: string): boolean {
    return this.modules.has(id);
  }

  /**
   * Obtiene la configuración de un módulo
   */
  getConfig(id: string): ModuleConfig | undefined {
    return this.modules.get(id)?.config;
  }

  /**
   * Desregistra un módulo
   */
  unregister(id: string): boolean {
    const module = this.modules.get(id);
    if (!module) return false;

    // Remover del índice de especialidades
    this.modulesBySpecialty.get(module.config.specialty)?.delete(id);

    return this.modules.delete(id);
  }

  /**
   * Limpia todos los módulos registrados
   */
  clear(): void {
    this.modules.clear();
    this.modulesBySpecialty.clear();
  }

  /**
   * Obtiene estadísticas del registro
   */
  getStats(): { totalModules: number; bySpecialty: Record<string, number> } {
    const bySpecialty: Record<string, number> = {};

    this.modulesBySpecialty.forEach((moduleIds, specialty) => {
      bySpecialty[specialty] = moduleIds.size;
    });

    return {
      totalModules: this.modules.size,
      bySpecialty
    };
  }
}

// Instancia singleton del registro
export const moduleRegistry = new ModuleRegistry();

/**
 * Función helper para registrar módulos fácilmente
 */
export function registerModule(
  id: string,
  name: string,
  specialty: SpecialtyModuleType,
  component: Component,
  options?: Partial<Omit<ModuleConfig, 'id' | 'name' | 'specialty'>>
): void {
  moduleRegistry.register({
    id,
    name,
    specialty,
    kind: options?.kind || 'form',
    description: options?.description || '',
    version: options?.version || '1.0.0',
    icon: options?.icon,
    author: options?.author,
    tags: options?.tags
  }, component);
}

/**
 * Función helper para registrar módulos asíncronos
 */
export function registerAsyncModule(
  id: string,
  name: string,
  specialty: SpecialtyModuleType,
  loader: () => Promise<{ default: Component }>,
  options?: Partial<Omit<ModuleConfig, 'id' | 'name' | 'specialty'>>
): void {
  moduleRegistry.registerAsync({
    id,
    name,
    specialty,
    kind: options?.kind || 'form',
    description: options?.description || '',
    version: options?.version || '1.0.0',
    icon: options?.icon,
    author: options?.author,
    tags: options?.tags
  }, loader);
}
