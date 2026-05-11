import prisma from '../../config/database.js';
import { EstadoInterconsulta, Rol, TipoInterconsulta, AuditAction } from '@prisma/client';
import { sseManager } from '../sse/manager.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Estados para interconsultas 1-a-1
 * Re-exportamos desde @prisma/client para mantener consistencia
 */
export type { EstadoInterconsulta };

/**
 * Datos para crear interconsulta 1-a-1
 */
export interface CrearInterconsultaParams {
  consultaId: string;
  mensaje: string;
  destinoCuentaId: string;
  tipo?: TipoInterconsulta;
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
    if (destinoCuenta.rol !== Rol.DOCTOR) {
      throw new Error('Solo se puede solicitar interconsulta a doctores');
    }

    // Verificar que el solicitante es un doctor
    const solicitante = await prisma.cuenta.findUnique({
      where: { id: cuentaIdSolicitante }
    });

    if (!solicitante) {
      throw new Error('Cuenta solicitante no encontrada');
    }

    if (solicitante.rol !== Rol.DOCTOR) {
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
        solicitante: cuentaIdSolicitante,
        destino: params.destinoCuentaId,
        tipo: params.tipo ?? TipoInterconsulta.basica,
        estado: EstadoInterconsulta.pendiente,
        mensaje: params.mensaje
      }
    });

    // Emitir notificación SSE al doctor destino
    try {
      await sseManager.sendEventToUser(params.destinoCuentaId, 'INTERCONSULTA_NUEVA', {
        interconsultaId: interconsulta.id,
        estado: interconsulta.estado,
        mensaje: 'Nueva interconsulta recibida'
      });
    } catch (error) {
      console.error('[InterconsultaService] Error sending SSE notification:', error);
    }

    // Registrar auditoría
    try {
      await AuditService.log({
        userId: cuentaIdSolicitante,
        action: AuditAction.RESOURCE_CREATE,
        resourceType: 'INTERCONSULTA' as any,
        resourceId: interconsulta.id,
        rolUsuario: Rol.DOCTOR,
        metadata: {
          consultaId: params.consultaId,
          destinoCuentaId: params.destinoCuentaId,
          tipo: params.tipo ?? TipoInterconsulta.basica
        }
      });
    } catch (error) {
      console.error('[InterconsultaService] Error logging audit:', error);
    }

    return {
      id: interconsulta.id,
      estado: interconsulta.estado,
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
    if (interconsulta.estado !== EstadoInterconsulta.pendiente) {
      throw new Error('Solo se pueden responder interconsultas pendientes');
    }

    const oldEstado = interconsulta.estado;

    // Actualizar estado
    const actualizada = await prisma.interconsulta.update({
      where: { id: params.interconsultaId },
      data: {
        estado: params.estado,
        respuesta: params.respuesta,
        respondidaEn: new Date()
      }
    });

    // Emitir notificación SSE al solicitante
    try {
      await sseManager.sendEventToUser(interconsulta.solicitante, 'INTERCONSULTA_STATUS_CHANGE', {
        interconsultaId: actualizada.id,
        oldStatus: oldEstado,
        newStatus: params.estado,
        respuesta: params.respuesta,
        mensaje: 'Interconsulta actualizada'
      });
    } catch (error) {
      console.error('[InterconsultaService] Error sending SSE notification:', error);
    }

    // Registrar auditoría
    try {
      await AuditService.log({
        userId: interconsulta.destino,
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: 'INTERCONSULTA' as any,
        resourceId: actualizada.id,
        rolUsuario: Rol.DOCTOR,
        metadata: {
          from: oldEstado,
          to: params.estado,
          respuesta: params.respuesta
        }
      });
    } catch (error) {
      console.error('[InterconsultaService] Error logging audit:', error);
    }

    return {
      id: actualizada.id,
      estado: actualizada.estado,
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
        solicitanteUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true,
            rol: true
          }
        },
        destinoUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true,
            rol: true
          }
        }
      },
      orderBy: { creadoEn: 'desc' as const }
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
        destino: doctorId,
        estado: EstadoInterconsulta.pendiente
      },
      include: {
        consulta: {
          select: {
            id: true,
            estado: true,
            pacienteId: true
          }
        },
        solicitanteUser: {
          select: {
            id: true,
            nombre: true,
            especialidad: true
          }
        }
      },
      orderBy: { creadoEn: 'asc' as const }
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
    return interconsulta.destino === doctorId && interconsulta.estado === EstadoInterconsulta.pendiente;
  }
}

// Exportar instancia singleton
export const interconsultaService = new InterconsultaService();
