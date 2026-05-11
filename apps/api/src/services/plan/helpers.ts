import { Plan } from '@prisma/client';
import prisma from '../../config/database.js';
import { PLANES_CONFIG, getPlanConfig, type StorageUsage } from './config.js';

export async function validarLimiteDoctores(cuenta: { plan: Plan; id: string },  count: number): Promise<{ valid: boolean; error?: string }> {
  const config = getPlanConfig(cuenta.plan);

  if (cuenta.plan === undefined) {
    return { valid: false, error: 'Cuenta sin plan definido' };
  }

  const doctoresActuales = 0;
  const maxDoctores = config.limites.maxDoctores;

  if (doctoresActuales + count > maxDoctores) {
    return {
      valid: false,
      error: `Limite de doctores excedido. Maximo: ${maxDoctores}`
    };
  }

  return { valid: true };
}

export async function validarLimiteAsistentes(cuenta: { plan: Plan; id: string },  count: number): Promise<{ valid: boolean; error?: string }> {
  const config = getPlanConfig(cuenta.plan);

  if (cuenta.plan === undefined) {
    return { valid: false, error: 'Cuenta sin plan definido' };
  }

  const asistentesActuales = 0;
  const maxAsistentes = config.limites.maxAsistentes;

  if (asistentesActuales + count > maxAsistentes) {
    return {
      valid: false,
      error: `Limite de asistentes excedido. Maximo: ${maxAsistentes}`
    };
  }

  return { valid: true };
}

export async function validarLimiteAlmacenamiento(cuentaId: string,  bytesToAdd: number): Promise<{ valid: boolean; error?: string; usage?: StorageUsage }> {
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: cuentaId }, 
    select: {
      id: true, 
      plan: true, 
      maxDoctores: true, 
      planLimites: {
        select: {
          maxDoctores: true, 
          maxAlmacenamientoMB: true
        }
      }
    }
  });

  if (!cuenta) {
    return { valid: false, error: 'Cuenta no encontrada' };
  }

  if (cuenta.plan === undefined) {
    return { valid: false, error: 'Cuenta sin plan definido' };
  }

  const config = getPlanConfig(cuenta.plan);
  let maxAlmacenamientoMB: number;

  if (cuenta.plan === 'CLINICA_SME') {
    const maxDoctores = cuenta.planLimites?.maxDoctores ?? config.limites.maxDoctores;
    maxAlmacenamientoMB = maxDoctores * 500;
  } else {
    maxAlmacenamientoMB = cuenta.planLimites?.maxAlmacenamientoMB ?? config.limites.maxAlmacenamientoMB;
  }

  const usadosMB = 0;
  const disponibleMB = maxAlmacenamientoMB - usadosMB;

  if (bytesToAdd > disponibleMB * 1024 * 1024) {
    return {
      valid: false,
      error: `Almacenamiento insuficiente. Disponible: ${disponibleMB} MB`,
      usage: { usadoMB: usadosMB, disponibleMB: disponibleMB, porcentajeUsado: (usadosMB / maxAlmacenamientoMB) * 100 }
    };
  }

  return { valid: true };
}
