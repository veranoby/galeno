// apps/api/src/services/agenda/reserva-service-class.ts
import { PrismaClient } from '@prisma/client';
import redis from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

export interface CrearReservaDto {
  pacienteId: string;
  profesionalId: string;
  disponibilidadId?: string;
  fechaCita: Date;
  tipoCita: 'presencial' | 'teleconsulta';
  motivo: string;
}

export interface ReservaFilter {
  pacienteId?: string;
  profesionalId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  estado?: string;
}

export class ReservaService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Creates a new reservation with distributed locking to prevent double-bookings
   */
  async crearReserva(datos: CrearReservaDto) {
    const lockKey = `reserva:${datos.profesionalId}:${datos.fechaCita.toISOString()}`;
    const lockTimeout = 30; // 30 seconds

    // Attempt to acquire distributed lock
    const lockAcquired = await redis.set(
      lockKey, 
      JSON.stringify({
        lockedBy: 'crearReserva', 
        timestamp: new Date().toISOString(),
        data: {
          profesionalId: datos.profesionalId,
          fechaCita: datos.fechaCita,
          pacienteId: datos.pacienteId
        }
      }),
      'PX', // Set expiry in milliseconds
      lockTimeout * 1000, // 30 seconds in ms
      'NX' // Only set if key doesn't exist (atomic operation)
    );

    if (!lockAcquired) {
      throw new Error('El horario está siendo gestionado por otro proceso. Por favor intente nuevamente.');
    }

    try {
      // Perform atomic transaction to check availability and create reservation
      const reserva = await this.prisma.$transaction(async (tx) => {
        // Double-check availability within the transaction
        const conflictingReservation = await tx.cita.findFirst({
          where: {
            doctorId: datos.profesionalId, 
            fechaHora: datos.fechaCita, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (conflictingReservation) {
          throw new Error(`El horario ${datos.fechaCita.toISOString()} ya está ocupado para el médico ${datos.profesionalId}`);
        }

        // Check if the patient already has an appointment at this time
        const patientConflict = await tx.cita.findFirst({
          where: {
            pacienteId: datos.pacienteId, 
            fechaHora: datos.fechaCita, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (patientConflict) {
          throw new Error(`El paciente ${datos.pacienteId} ya tiene una cita programada para ${datos.fechaCita.toISOString()}`);
        }

        // Create the reservation
        return await tx.cita.create({
          data: {
            doctorId: datos.profesionalId,
            pacienteId: datos.pacienteId,
            fechaHora: datos.fechaCita,
            tipo: datos.tipoCita,
            estado: 'programada', // Default to scheduled
            slotId: datos.disponibilidadId
          }
        });
      });

      // Generate video link if it's a teleconsulta
      if (datos.tipoCita === 'teleconsulta') {
        await this.generateVideoLink(reserva.id);
      }

      return reserva;
    } catch (error) {
      logger.error('Error creating reservation:', error);
      
      // Re-throw specific errors or generic ones
      if (error.message.includes('ya está ocupado') || error.message.includes('ya tiene una cita')) {
        throw error; // Re-throw the specific conflict error
      }

      throw new Error('Error al crear la reserva. Por favor intente nuevamente.');
    } finally {
      // Always release the lock to prevent deadlocks
      try {
        await redis.del(lockKey);
      } catch (lockError) {
        logger.error('Error releasing Redis lock:',  lockError);
        // Don't throw here as the main operation succeeded
      }
    }
  }

  /**
   * Confirm a reservation
   */
  async confirmarReserva(id: string) {
    const reserva = await this.prisma.cita.findUnique({
      where: { id }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }
      }
    });

    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    if (reserva.estado === 'cancelada') {
      throw new Error('No se puede confirmar una reserva cancelada');
    }

    const reservaConfirmada = await this.prisma.cita.update({
      where: { id }, 
      data: {
        estado: 'confirmada'
      }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }
      }
    });

    return reservaConfirmada;
  }

  /**
   * Cancel a reservation
   */
  async cancelarReserva(id: string,  motivoCancelacion?: string) {
    const reserva = await this.prisma.cita.findUnique({
      where: { id }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }
      }
    });

    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    // Check cancellation policy (24 hours advance notice)
    const hoursBefore = (reserva.fechaHora.getTime() - new Date().getTime()) / (1000 * 60 * 60);

    if (hoursBefore < 24) {
      throw new Error('Las reservas solo pueden cancelarse con al menos 24 horas de anticipación');
    }

    const reservaCancelada = await this.prisma.cita.update({
      where: { id },
      data: {
        estado: 'cancelada',
        motivoCancelacion: motivoCancelacion || 'Cancelación por el paciente'
      },
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        }
      }
    });

    return reservaCancelada;
  }

  /**
   * Get reservations by filters
   */
  async obtenerReservas(filtros: ReservaFilter) {
    const whereClause: any = {};

    if (filtros.pacienteId) whereClause.pacienteId = filtros.pacienteId;
    if (filtros.profesionalId) whereClause.doctorId = filtros.profesionalId;
    if (filtros.estado) whereClause.estado = filtros.estado;

    if (filtros.fechaDesde || filtros.fechaHasta) {
      whereClause.fechaHora = {};
      if (filtros.fechaDesde) whereClause.fechaHora.gte = filtros.fechaDesde;
      if (filtros.fechaHasta) whereClause.fechaHora.lte = filtros.fechaHasta;
    }

    return await this.prisma.cita.findMany({
      where: whereClause, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }, 
        doctor: {
          select: {
            id: true, 
            nombre: true
          }
        }
      }, 
      orderBy: {
        fechaHora: 'asc'
      }
    });
  }

  /**
   * Get a specific reservation by ID
   */
  async obtenerReservaPorId(id: string) {
    return await this.prisma.cita.findUnique({
      where: { id }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }, 
        doctor: {
          select: {
            id: true, 
            nombre: true
          }
        }
      }
    });
  }

  /**
   * Private method to generate video conference link for teleconsultations
   */
  private async generateVideoLink(reservaId: string): Promise<void> {
    // In a real implementation, this would integrate with Jitsi, Zoom, etc.
    // For now, we'll create a mock video link
    const videoLink = `https://meet.galeno.ec/${reservaId}-${Date.now()}`;

    await this.prisma.cita.update({
      where: { id: reservaId }, 
      data: { linkVideo: videoLink }
    });
  }
}