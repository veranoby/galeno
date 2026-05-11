import prisma from '../../config/database.js';
import { RedisLockManager } from './redis-lock-manager.js';
import { differenceInHours } from 'date-fns';
import { CrearReservaDto } from './types.js';

export interface CrearReservaResult {
  success: boolean;
  cita?: any;
  error?: string;
}

// Función auxiliar para generar tokens seguros
function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function crearReserva(data: CrearReservaDto): Promise<CrearReservaResult> {
  const resourceKey = `reserva:${data.doctorId}:${new Date(data.fechaHora).toISOString()}`;

  return await RedisLockManager.executeWithLock(resourceKey,  async () => {
    try {
      // Transacción atómica de Prisma
      const cita = await prisma.$transaction(async (tx) => {
        const existente = await tx.cita.findFirst({
          where: {
            doctorId: data.doctorId, 
            fechaHora: data.fechaHora, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (existente) {
          throw new Error('El horario ya está reservado');
        }

        // Verificar si hay un slot asociado y si coincide con la fecha/hora
        if (data.slotId) {
          const slot = await tx.slotDisponibilidad.findUnique({
            where: { id: data.slotId }
          });

          if (!slot) {
            throw new Error('Slot no encontrado');
          }

          const diaSemana = new Date(data.fechaHora).getDay();
          if (slot.diaSemana !== diaSemana) {
            throw new Error('El slot no corresponde al día seleccionado');
          }

          const [horaInicioSlot, minInicioSlot] = slot.horaInicio.split(':').map(Number);
          const [horaFinSlot, minFinSlot] = slot.horaFin.split(':').map(Number);
          
          const dateObj = new Date(data.fechaHora);
          const horaCita = dateObj.getHours();
          const minCita = dateObj.getMinutes();
          
          const minutosCita = horaCita * 60 + minCita;
          const minutosInicioSlot = horaInicioSlot * 60 + minInicioSlot;
          const minutosFinSlot = horaFinSlot * 60 + minFinSlot;
          
          if (minutosCita < minutosInicioSlot || minutosCita >= minutosFinSlot) {
            throw new Error('La hora de la cita no coincide con el horario del slot');
          }
        }

        // Crear cita
        return tx.cita.create({
          data: {
            doctorId: data.doctorId, 
            pacienteId: data.pacienteId, 
            slotId: data.slotId, 
            fechaHora: data.fechaHora, 
            tipo: data.tipo as any,
            estado: 'programada',
            ubicacionId: data.ubicacionId
          }
        });
      });

      // Generar link de video si es teleconsulta
      if (data.tipo=== 'teleconsulta') {
        const videoLink = `https://meet.jit.si/galeno-${cita.id}`;
        
        const updatedCita = await prisma.cita.update({
          where: { id: cita.id }, 
          data: { 
            linkVideo: videoLink, 
            tokenAcceso: generateSecureToken()
          }
        });
        return { success: true, cita: updatedCita };
      }

      return { success: true, cita };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al crear la reserva'
      };
    }
  }, { timeout: 30, maxRetries: 3 });
}

export async function cancelarReserva(citaId: string,  doctorId: string,  motivo?: string): Promise<CrearReservaResult> {
  try {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId }
    });

    if (!cita) {
      return { success: false, error: 'Cita no encontrada' };
    }

    if (cita.doctorId !== doctorId && cita.pacienteId !== doctorId) {
      return { success: false, error: 'No autorizado para cancelar esta cita' };
    }

    const horasAntes = differenceInHours(new Date(cita.fechaHora), new Date());

    if (horasAntes < 24) {
      return { success: false, error: 'Solo se puede cancelar con 24 horas de anticipación' };
    }

    const citaCancelada = await prisma.cita.update({
      where: { id: citaId }, 
      data: { 
        estado: 'cancelada', 
        ...(motivo && { motivoCancelacion: motivo })
      }
    });

    return { success: true, cita: citaCancelada };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al cancelar la reserva' };
  }
}

export async function confirmarReserva(citaId: string,  doctorId: string): Promise<CrearReservaResult> {
  try {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId }
    });

    if (!cita) {
      return { success: false, error: 'Cita no encontrada' };
    }

    if (cita.doctorId !== doctorId) {
      return { success: false, error: 'No autorizado para confirmar esta cita' };
    }

    if (cita.estado !== 'programada') {
      return { success: false, error: 'La cita ya ha sido confirmada o está en otro estado' };
    }

    const citaConfirmada = await prisma.cita.update({
      where: { id: citaId }, 
      data: { estado: 'confirmada' }
    });

    return { success: true, cita: citaConfirmada };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al confirmar la reserva' };
  }
}

export async function reprogramarReserva(
  citaId: string,  
  doctorId: string,  
  nuevaFechaHora: Date
): Promise<CrearReservaResult> {
  const resourceKey = `reprogramar:${citaId}`;

  return await RedisLockManager.executeWithLock(resourceKey,  async () => {
    try {
      const cita = await prisma.cita.findUnique({
        where: { id: citaId }
      });

      if (!cita) {
        return { success: false, error: 'Cita no encontrada' };
      }

      if (cita.doctorId !== doctorId) {
        return { success: false, error: 'No autorizado para reprogramar esta cita' };
      }

      const horasAntes = differenceInHours(new Date(cita.fechaHora), new Date());

      if (horasAntes < 24) {
        return { success: false, error: 'Solo se puede reprogramar con 24 horas de anticipación' };
      }

      const existente = await prisma.cita.findFirst({
        where: {
          doctorId: cita.doctorId, 
          fechaHora: nuevaFechaHora, 
          estado: {
            in: ['programada',  'confirmada',  'en_progreso']
          }, 
          id: { not: citaId }
        }
      });

      if (existente) {
        return { success: false, error: 'El nuevo horario ya está ocupado' };
      }

      const citaReprogramada = await prisma.cita.update({
        where: { id: citaId }, 
        data: { 
          fechaHora: nuevaFechaHora, 
          estado: 'programada'
        }
      });

      return { success: true, cita: citaReprogramada };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al reprogramar la reserva' };
    }
  }, { timeout: 30, maxRetries: 3 });
}
