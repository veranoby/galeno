// apps/api/src/services/module/module.service.ts

import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

/**
 * Tipos de especialidades médicas
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
 * Tipos de módulos
 */
export type ModuleKind = 'chart' | 'viewer' | 'form' | 'calculator' | 'atlas';

/**
 * Configuración de un módulo
 */
export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  specialty: SpecialtyModuleType;
  kind: ModuleKind;
  version: string;
  author?: string;
  tags?: string[];
  icon?: string;
  enabled: boolean;
}

/**
 * Datos guardados de un módulo para un paciente
 */
export interface ModuleData {
  id: string;
  moduleId: string;
  pacienteId: string;
  consultaId?: string;
  datos: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registro de módulos disponibles
 */
const AVAILABLE_MODULES: ModuleConfig[] = [
  {
    id: 'odontograma',
    name: 'Odontograma',
    description: 'Registro visual del estado dental con tratamientos por diente y cara',
    specialty: 'odontologia',
    kind: 'chart',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['diente', 'tratamiento', 'odontología'],
    icon: 'mdi-tooth',
    enabled: true,
  },
  {
    id: 'retina-atlas',
    name: 'Retina Atlas',
    description: 'Visor de imágenes de retina con anotaciones y comparación',
    specialty: 'oftalmologia',
    kind: 'viewer',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['retina', 'ojo', 'imagen', 'anotación'],
    icon: 'mdi-eye',
    enabled: true,
  },
  {
    id: 'curvas-crecimiento',
    name: 'Curvas de Crecimiento',
    description: 'Seguimiento del crecimiento infantil según estándares OMS',
    specialty: 'pediatria',
    kind: 'chart',
    version: '1.0.0',
    author: 'Galeno',
    tags: ['crecimiento', 'oms', 'pediatría', 'percentil'],
    icon: 'mdi-chart-line',
    enabled: true,
  },
];

/**
 * Servicio de módulos dinámicos
 */
export class ModuleService {
  /**
   * Obtiene todos los módulos disponibles
   */
  async getAllModules(): Promise<ModuleConfig[]> {
    return AVAILABLE_MODULES.filter(m => m.enabled);
  }

  /**
   * Obtiene módulos por especialidad
   */
  async getModulesBySpecialty(specialty: SpecialtyModuleType): Promise<ModuleConfig[]> {
    return AVAILABLE_MODULES.filter(
      m => m.enabled && (m.specialty === specialty || specialty === 'general')
    );
  }

  /**
   * Obtiene un módulo por su ID
   */
  async getModuleById(id: string): Promise<ModuleConfig | null> {
    const module = AVAILABLE_MODULES.find(m => m.id === id);
    return module?.enabled ? module : null;
  }

  /**
   * Guarda datos de un módulo para un paciente
   */
  async saveModuleData(data: Omit<ModuleData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModuleData> {
    logger.info(`Saving module data: ${data.moduleId} for patient: ${data.pacienteId}`);

    // Validate module data before saving
    this.validateModuleData(data.moduleId, data.datos);

    const saved = await prisma.moduleData.create({
      data: {
        moduleId: data.moduleId,
        pacienteId: data.pacienteId,
        consultaId: data.consultaId,
        datos: data.datos as any
      }
    });

    return {
      id: saved.id,
      moduleId: saved.moduleId,
      pacienteId: saved.pacienteId,
      consultaId: saved.consultaId,
      datos: saved.datos as Record<string, unknown>,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    };
  }

  /**
   * Obtiene datos de un módulo para un paciente
   */
  async getModuleData(
    moduleId: string,
    pacienteId: string,
    consultaId?: string
  ): Promise<ModuleData | null> {
    logger.info(`Fetching module data: ${moduleId} for patient: ${pacienteId}`);

    const saved = await prisma.moduleData.findFirst({
      where: {
        moduleId,
        pacienteId,
        consultaId: consultaId || null
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!saved) {
      return null;
    }

    return {
      id: saved.id,
      moduleId: saved.moduleId,
      pacienteId: saved.pacienteId,
      consultaId: saved.consultaId,
      datos: saved.datos as Record<string, unknown>,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    };
  }

  /**
   * Lista datos de módulos de un paciente
   */
  async listPatientModuleData(pacienteId: string): Promise<ModuleData[]> {
    logger.info(`Listing module data for patient: ${pacienteId}`);

    const savedList = await prisma.moduleData.findMany({
      where: { pacienteId },
      orderBy: { updatedAt: 'desc' }
    });

    return savedList.map(saved => ({
      id: saved.id,
      moduleId: saved.moduleId,
      pacienteId: saved.pacienteId,
      consultaId: saved.consultaId,
      datos: saved.datos as Record<string, unknown>,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    }));
  }

  /**
   * Elimina datos de un módulo
   */
  async deleteModuleData(id: string): Promise<boolean> {
    logger.info(`Deleting module data: ${id}`);

    await prisma.moduleData.delete({
      where: { id }
    });

    return true;
  }

  /**
   * Valida datos de un módulo antes de guardar
   */
  validateModuleData(moduleId: string, data: Record<string, unknown>): boolean {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    // Validación básica según el tipo de módulo
    switch (moduleId) {
      case 'odontograma':
        return this.validateOdontogramaData(data);
      case 'retina-atlas':
        return this.validateRetinaData(data);
      case 'curvas-crecimiento':
        return this.validateCrecimientoData(data);
      default:
        return true;
    }
  }

  /**
   * Valida datos del odontograma
   */
  private validateOdontogramaData(data: Record<string, unknown>): boolean {
    if (!data.dientes || typeof data.dientes !== 'object') {
      return false;
    }

    const dientes = data.dientes as Record<string, unknown>;
    for (const [id, diente] of Object.entries(dientes)) {
      if (!diente || typeof diente !== 'object') {
        return false;
      }

      const d = diente as Record<string, unknown>;
      if (!d.estado || typeof d.estado !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Valida datos del retina atlas
   */
  private validateRetinaData(data: Record<string, unknown>): boolean {
    if (!data.imagenes || !Array.isArray(data.imagenes)) {
      return false;
    }

    return data.imagenes.every((img: unknown) => {
      if (!img || typeof img !== 'object') {
        return false;
      }

      const imagen = img as Record<string, unknown>;
      return (
        imagen.id &&
        imagen.tipo &&
        imagen.ojo &&
        imagen.url
      );
    });
  }

  /**
   * Valida datos de curvas de crecimiento
   */
  private validateCrecimientoData(data: Record<string, unknown>): boolean {
    if (!data.sexo || !['masculino', 'femenino'].includes(data.sexo as string)) {
      return false;
    }

    if (!data.mediciones || !Array.isArray(data.mediciones)) {
      return false;
    }

    return data.mediciones.every((med: unknown) => {
      if (!med || typeof med !== 'object') {
        return false;
      }

      const medicion = med as Record<string, unknown>;
      return (
        medicion.tipo &&
        typeof medicion.valor === 'number' &&
        typeof medicion.edadMeses === 'number'
      );
    });
  }
}

// Exportar instancia singleton
export const moduleService = new ModuleService();
