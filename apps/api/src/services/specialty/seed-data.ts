/**
 * Specialty Seed Data
 * Galeno - Ecuador Health 360
 *
 * Initial data for medical specialties with tool configurations
 * Each specialty has specific tools and features enabled based on clinical needs
 */

import type { Prisma } from '@prisma/client';
import type { SpecialtyConfig } from './types.js';
import { TOOL_CATEGORIES } from './types.js';

// ============= SPECIALTY CONFIGURATIONS =============

/**
 * Medicina General - Primary care with basic diagnostic tools
 */
const medicinaGeneralConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'estetoscopio',
      name: 'Estetoscopio Digital',
      description: 'Registro de sonidos cardíacos y respiratorios',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'tensiometro',
      name: 'Tensiómetro',
      description: 'Medición de presión arterial',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: true,
      order: 2
    },
    {
      id: 'termometro',
      name: 'Termómetro Digital',
      description: 'Medición de temperatura corporal',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: true,
      order: 3
    },
    {
      id: 'glucometro',
      name: 'Glucómetro',
      description: 'Medición de glucosa en sangre',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: false,
      order: 4
    },
    {
      id: 'calculadora-imc',
      name: 'Calculadora IMC',
      description: 'Índice de Masa Corporal',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 5
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: false,
    iaAsistente: true
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Pediatría - Child healthcare with growth monitoring
 */
const pediatriaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'curvas-crecimiento',
      name: 'Curvas de Crecimiento OMS',
      description: 'Seguimiento de crecimiento pediátrico',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'vacunacion',
      name: 'Esquema de Vacunación',
      description: 'Control de vacunas del PAI Ecuador',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: true,
      order: 2
    },
    {
      id: 'calculadora-dosis',
      name: 'Calculadora de Dosis Pediátrica',
      description: 'Cálculo de dosis por peso y edad',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 3
    },
    {
      id: 'estetoscopio-pediatrico',
      name: 'Estetoscopio Pediátrico',
      description: 'Auscultación infantil',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 4
    },
    {
      id: 'oximetro-pediatrico',
      name: 'Oxímetro Pediátrico',
      description: 'Saturación de oxígeno',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: false,
      order: 5
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: true
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Odontología - Dental care with odontogram
 */
const odontologiaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'odontograma',
      name: 'Odontograma Digital',
      description: 'Registro gráfico de piezas dentales',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'radiografia-dental',
      name: 'Radiografía Dental',
      description: 'Visualización de radiografías periapicales',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: true,
      order: 2
    },
    {
      id: 'periodontograma',
      name: 'Periodontograma',
      description: 'Evaluación periodontal',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 3
    },
    {
      id: 'camara-intraoral',
      name: 'Cámara Intraoral',
      description: 'Fotografía intraoral',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: false,
      order: 4
    }
  ],
  features: {
    teleconsulta: false,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: false
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Cardiología - Cardiac care with ECG and echo
 */
const cardiologiaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'ecg',
      name: 'Electrocardiógrafo',
      description: 'Registro e interpretación de ECG',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'ecocardiograma',
      name: 'Ecocardiograma',
      description: 'Ecocardiografía transtorácica',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: true,
      order: 2
    },
    {
      id: 'holter',
      name: 'Holter de Ritmo',
      description: 'Monitoreo ECG ambulatorio 24h',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: false,
      order: 3
    },
    {
      id: 'mapa',
      name: 'MAPA',
      description: 'Monitoreo ambulatorio de presión arterial',
      category: TOOL_CATEGORIES.MONITORING,
      enabled: true,
      required: false,
      order: 4
    },
    {
      id: 'prueba-esfuerzo',
      name: 'Prueba de Esfuerzo',
      description: 'Ergometría con electrocardiograma',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 5
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: true
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Oftalmología - Eye care with retina atlas
 */
const oftalmologiaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'tabla-optotipos',
      name: 'Tabla de Optotipos',
      description: 'Evaluación de agudeza visual',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'retina-atlas',
      name: 'Atlas de Retina',
      description: 'Referencia de patologías retinales',
      category: TOOL_CATEGORIES.EDUCATION,
      enabled: true,
      required: false,
      order: 2
    },
    {
      id: 'tonometria',
      name: 'Tonómetro',
      description: 'Medición de presión intraocular',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 3
    },
    {
      id: 'lampara-hendidura',
      name: 'Lámpara de Hendidura',
      description: 'Examen del segmento anterior',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 4
    },
    {
      id: 'fondo-ojo',
      name: 'Fondo de Ojo',
      description: 'Retinografía digital',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: false,
      order: 5
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: false
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Dermatología - Skin care with dermatoscopy
 */
const dermatologiaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'dermatoscopio',
      name: 'Dermatoscopio Digital',
      description: 'Visualización de lesiones cutáneas',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'atlas-lesiones',
      name: 'Atlas de Lesiones',
      description: 'Referencia de patologías dermatológicas',
      category: TOOL_CATEGORIES.EDUCATION,
      enabled: true,
      required: false,
      order: 2
    },
    {
      id: 'camara-dermatologica',
      name: 'Cámara Dermatológica',
      description: 'Fotografía clínica de lesiones',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: true,
      order: 3
    },
    {
      id: 'luz-wood',
      name: 'Lámpara de Wood',
      description: 'Diagnóstico de infecciones fúngicas',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 4
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: true
  },
  metadata: {
    version: '1.0.0'
  }
};

/**
 * Traumatología - Orthopedic care with imaging
 */
const traumatologiaConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'rayos-x',
      name: 'Rayos X',
      description: 'Visualización de radiografías óseas',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: true,
      order: 1
    },
    {
      id: 'artroscopio',
      name: 'Artroscopio',
      description: 'Visualización articular',
      category: TOOL_CATEGORIES.PROCEDURE,
      enabled: true,
      required: false,
      order: 2
    },
    {
      id: 'resonancia-magnetica',
      name: 'Resonancia Magnética',
      description: 'Visualización de tejidos blandos',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: false,
      order: 3
    },
    {
      id: 'tomografia',
      name: 'Tomografía Computarizada',
      description: 'TC ósea',
      category: TOOL_CATEGORIES.IMAGING,
      enabled: true,
      required: false,
      order: 4
    },
    {
      id: 'densitometria',
      name: 'Densitometría Ósea',
      description: 'Evaluación de densidad mineral ósea',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: false,
      order: 5
    }
  ],
  features: {
    teleconsulta: false,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: true,
    iaAsistente: false
  },
  metadata: {
    version: '1.0.0'
  }
};

// ============= EXPORT SEED DATA =============

/**
 * Array of specialty seed data for database insertion
 */
export const specialtySeedData: Array<{
  nombre: string;
  nombreCorto: string;
  herramientas: SpecialtyConfig;
}> = [
  {
    nombre: 'Medicina General',
    nombreCorto: 'medicina-general',
    herramientas: medicinaGeneralConfig
  },
  {
    nombre: 'Pediatría',
    nombreCorto: 'pediatria',
    herramientas: pediatriaConfig
  },
  {
    nombre: 'Odontología',
    nombreCorto: 'odontologia',
    herramientas: odontologiaConfig
  },
  {
    nombre: 'Cardiología',
    nombreCorto: 'cardiologia',
    herramientas: cardiologiaConfig
  },
  {
    nombre: 'Oftalmología',
    nombreCorto: 'oftalmologia',
    herramientas: oftalmologiaConfig
  },
  {
    nombre: 'Dermatología',
    nombreCorto: 'dermatologia',
    herramientas: dermatologiaConfig
  },
  {
    nombre: 'Traumatología',
    nombreCorto: 'traumatologia',
    herramientas: traumatologiaConfig
  }
];

/**
 * Get Prisma create input for a specialty
 */
export function getSpecialtyCreateInput(
  nombre: string,
  nombreCorto: string,
  config: SpecialtyConfig
): Prisma.EspecialidadCreateInput {
  return {
    nombre,
    nombreCorto,
    herramientas: config as unknown as Prisma.InputJsonValue,
    activo: true
  };
}

/**
 * Get all specialty names for reference
 */
export function getSpecialtyNames(): string[] {
  return specialtySeedData.map(s => s.nombre);
}

/**
 * Get all specialty short names for reference
 */
export function getSpecialtyShortNames(): string[] {
  return specialtySeedData.map(s => s.nombreCorto);
}

/**
 * Find specialty config by short name
 */
export function getSpecialtyConfigByShortName(shortName: string): SpecialtyConfig | undefined {
  const specialty = specialtySeedData.find(s => s.nombreCorto === shortName);
  return specialty?.herramientas;
}
