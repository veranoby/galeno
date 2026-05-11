import { Plan } from '@prisma/client';

export interface PlanConfig {
  nombre: string;
  precioMensual: number;
  limites: {
    maxDoctores: number;
    maxAsistentes: number;
    maxAlmacenamientoMB: number;
  };
  caracteristicas: {
    tieneInterconsultas: boolean;
    tieneTeleconsultas: boolean;
    tieneHealthWallet: boolean;
    tieneSRIIntegracion: boolean;
    tieneIAAsistente: boolean;
    tieneSoportePrioridad: boolean;
  };
}

export const PLANES_CONFIG: Record<Plan, PlanConfig> = {
  FREE: {
    nombre: 'Gratis',
    precioMensual: 0,
    limites: {
      maxDoctores: 1,
      maxAsistentes: 0,
      maxAlmacenamientoMB: 500,
    },
    caracteristicas: {
      tieneInterconsultas: false,
      tieneTeleconsultas: false,
      tieneHealthWallet: false,
      tieneSRIIntegracion: false,
      tieneIAAsistente: false,
      tieneSoportePrioridad: false,
    }
  },
  PREMIUM: {
    nombre: 'Premium',
    precioMensual: 10,
    limites: {
      maxDoctores: 1,
      maxAsistentes: 2,
      maxAlmacenamientoMB: 500,
    },
    caracteristicas: {
      tieneInterconsultas: true,
      tieneTeleconsultas: true,
      tieneHealthWallet: true,
      tieneSRIIntegracion: true,
      tieneIAAsistente: true,
      tieneSoportePrioridad: false,
    }
  },
  CLINICA_SME: {
    nombre: 'Clinica SME',
    precioMensual: 99,
    limites: {
      maxDoctores: 10,
      maxAsistentes: 20,
      maxAlmacenamientoMB: 500,
    },
    caracteristicas: {
      tieneInterconsultas: true,
      tieneTeleconsultas: true,
      tieneHealthWallet: true,
      tieneSRIIntegracion: true,
      tieneIAAsistente: true,
      tieneSoportePrioridad: true,
    }
  },
} as const;

export interface PlanLimits {
  maxDoctores: number;
  maxAsistentes: number;
  maxAlmacenamientoMB: number;
}

export interface StorageUsage {
  usadoMB: number;
  disponibleMB: number;
  porcentajeUsado: number;
}

export function getPlanConfig(plan: Plan) {
  return PLANES_CONFIG[plan];
}

export function getCaracteristicas(plan: Plan) {
  return getPlanConfig(plan).caracteristicas;
}
