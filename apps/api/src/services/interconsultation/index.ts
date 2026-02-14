import prisma from '../../config/database.js';
import { EstadoConsulta } from '@prisma/client';

/**
 * Estados para interconsultas 1-a-1
 */
export enum EstadoInterconsulta {
  pendiente = 'pendiente',
  aceptada = 'aceptada',
  rechazada = 'rechazada',
  completada = 'completada'
}

/**
 * Datos para crear interconsulta 1-a-1
 */
export interface CrearInterconsultaParams {
  consultaId: string;
  mensaje: string;
  destinoCuentaId: string;
}

/**
 * Datos para responder a interconsulta
 */
export interface ResponderInterconsultaParams {
  interconsultaId: string;
  estado: EstadoInterconsulta;
  respuesta?: string;
}

/**
 * Resultado de crear interconsulta
 */
export interface CrearResult {
  id: string;
  estado: EstadoInterconsulta;
  mensaje: string;
}

/**
 * Servicio de interconsultas 1-a-1
 *
 * Implementa el sistema donde un doctor puede solicitar
 * interconsulta a otro doctor sobre una consulta
 */
export class InterconsultaService {
  /**
   * Crear nueva solicitud de interconsulta 1-a-1
   *
   * @param cuentaIdSolicitante - ID del doctor que solicita la interconsulta
   * @param params - Datos de la interconsulta
   * @returns Interconsulta creada
   */
  async crearInterconsulta(
    cuentaIdSolicitante: string,
    params: CrearInterconsultaParams
  ): Promise<CrearResult> {
    // Verificar que la consulta existe
    const consulta = await prisma.consulta.findUnique({
      where: { id: params.consultaId }
    });

    if (!consulta) {
      throw new Error('Consulta no encontrada');
    }

    // Verificar que el doctor destino existe
    const destinoCuenta = await prisma.cuenta.findUnique({
      where: { id: params.destinoCuentaId }
    });

    if (!destinoCuenta) {
      throw new Error('Cuenta destino no encontrada');
    }

    // Verificar que destinoCuenta es un doctor (no asistente)
    if (destinoCuenta.rol === 'ASISTENTE' || destinoCuenta.rol === 'ENFERMERA') {
      throw new Error('Solo se puede solicitar interconsulta a doctores');
    }

    // Verificar que el solicitante es un doctor
    const solicitante = await prisma.cuenta.findUnique({
      where: { id: cuentaIdSolicitante }
    });

    if (!solicitante) {
      throw new Error('Cuenta solicitante no encontrada');
    }

    if (solicitante.rol !== 'DOCTOR') {
      throw new Error('Solo doctores pueden solicitar interconsultas');
    }

    // Verificar que no sea interconsulta a sí mismo
    if (consulta.doctorId === params.destinoCuentaId) {
      throw new Error('No se puede solicitar interconsulta al mismo doctor');
    }

    // Crear interconsulta
    const interconsulta = await prisma.interconsulta.create({
      data: {
        consultaId: params.consultaId,
        solicitanteId: cuentaIdSolicitante,
        destinoId: params.destinoCuentaId,
        estado: 'pendiente' as EstadoInterconsulta,
        mensaje: params.mensaje
      }
    });

    return {
      id: interconsulta.id,
      estado: interconsulta.estado as EstadoInterconsulta,
      mensaje: 'Interconsulta creada exitosamente'
    };
  }

  /**
   * Responder interconsulta
   *
   * @param params - Datos para responder
   * @returns Interconsulta actualizada
   */
  async responderInterconsulta(
    params: ResponderInterconsultaParams
  ): Promise<CrearResult> {
    // Obtener interconsulta
    const interconsulta = await prisma.interconsulta.findUnique({
      where: { id: params.interconsultaId }
    });

    if (!interconsulta) {
      throw new Error('Interconsulta no encontrada');
    }

    // Verificar que la interconsulta está pendiente
    if (interconsulta.estado !== 'pendiente') {
      throw new Error('Solo se pueden responder interconsultas pendientes');
    }

    // Actualizar estado
    const actualizada = await prisma.interconsulta.update({
      where: { id: params.interconsultaId },
      data: {
        estado: params.estado,
        respuesta: params.respuesta
      }
    });

    return {
      id: actualizada.id,
      estado: actualizada.estado as EstadoInterconsulta,
      mensaje: 'Interconsulta actualizada exitosamente'
    };
  }

  /**
   * Obtener interconsultas de una consulta
   *
   * @param consultaId - ID de la consulta
   * @returns Lista de interconsultas
   */
  async obtenerInterconsultas(consultaId: string) {
    const interconsultas = await prisma.interconsulta.findMany({
      where: { consultaId },
      include: {
        solicitante: {
          select: {
            id: true,
            nombre: true,
            especialidad: true,
            rol: true
          }
        },
        destino: {
          select: {
            id: true,
            nombre: true,
            especialidad: true,
            rol: true
          }
        }
      },
      orderBy: { createdAt: 'desc' as const }
    });

    return interconsultas;
  }

  /**
   * Obtener interconsultas pendientes para un doctor
   *
   * @param doctorId - ID del doctor
   * @returns Lista de interconsultas pendientes
   */
  async obtenerInterconsultasPendientes(doctorId: string) {
    const interconsultas = await prisma.interconsulta.findMany({
      where: {
        destinoId: doctorId,
        estado: 'pendiente' as const
      },
      include: {
        consulta: {
          select: {
            id: true,
            estado: true,
            pacienteId: true
          }
        },
        solicitante: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: { createdAt: 'asc' as const }
    });

    return interconsultas;
  }

  /**
   * Verificar si un doctor puede responder a interconsultas
   *
   * @param doctorId - ID del doctor
   * @param interconsultaId - ID de la interconsulta
   * @returns true si puede responder
   */
  async puedeResponderInterconsulta(
    doctorId: string,
    interconsultaId: string
  ): Promise<boolean> {
    const interconsulta = await prisma.interconsulta.findUnique({
      where: { id: interconsultaId }
    });

    if (!interconsulta) {
      return false;
    }

    // Verificar que el doctor es el destino de la interconsulta
    return interconsulta.destinoId === doctorId && interconsulta.estado === 'pendiente';
  }
}

// Exportar instancia singleton
export const interconsultaService = new InterconsultaService();

// Exportar tipos
export type { EstadoInterconsulta, CrearInterconsultaParams, ResponderInterconsultaParams, CrearResult };
