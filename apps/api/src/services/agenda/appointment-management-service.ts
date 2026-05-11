// apps/api/src/services/agenda/appointment-management-service.ts
import prisma from '../../config/database.js';
import { Cita, Prisma } from '@prisma/client';
import { RedisLockManager } from './redis-lock-manager.js';
import { logger } from '../../utils/logger.js';

// Interfaces
export interface CreateAppointmentDto {
  doctorId: string;
  pacienteId: string;
  fechaHora: Date;
  tipo: 'presencial' | 'teleconsulta';
  ubicacionId?: string;
  slotId?: string;
  motivo?: string;
}

export interface UpdateAppointmentDto {
  fechaHora?: Date;
  tipo?: 'presencial' | 'teleconsulta';
  estado?: string;
  ubicacionId?: string;
  motivo?: string;
}

export interface AppointmentFilters {
  doctorId?: string;
  pacienteId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  estado?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Appointment Management Service
 * Handles comprehensive appointment lifecycle management with Redis locks to prevent double-bookings
 */
export class AppointmentManagementService {
  
  /**
   * Get appointments with filtering and pagination
   */
  async getAppointments(filters: AppointmentFilters): Promise<Cita[]> {
    const whereClause: Prisma.CitaWhereInput = {};

    if (filters.doctorId) whereClause.doctorId = filters.doctorId;
    if (filters.pacienteId) whereClause.pacienteId = filters.pacienteId;
    if (filters.estado) whereClause.estado = filters.estado as any;
    if (filters.tipo) whereClause.tipo = filters.tipo as any;

    if (filters.fechaDesde || filters.fechaHasta) {
      whereClause.fechaHora = {};
      if (filters.fechaDesde) whereClause.fechaHora.gte = filters.fechaDesde;
      if (filters.fechaHasta) whereClause.fechaHora.lte = filters.fechaHasta;
    }

    const queryOptions: Prisma.CitaFindManyArgs = {
      where: whereClause,
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true
          }
        },
        doctor: {
          select: {
            id: true,
            nombre: true
          }
        },
        ubicacion: {
          select: {
            id: true,
            nombre: true,
            direccion: true
          }
        }
      },
      orderBy: {
        fechaHora: 'asc'
      }
    };

    if (filters.limit) {
      queryOptions.take = filters.limit;
      if (filters.offset) {
        queryOptions.skip = filters.offset;
      }
    }

    return await prisma.cita.findMany(queryOptions);
  }

  /**
   * Get a specific appointment by ID
   */
  async getAppointmentById(id: string): Promise<Cita | null> {
    return await prisma.cita.findUnique({
      where: { id }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true, 
            telefono: true, 
            email: true
          }
        }, 
        doctor: {
          select: {
            id: true, 
            nombre: true, 
            especialidad: true
          }
        }, 
        ubicacion: {
          select: {
            id: true, 
            nombre: true, 
            direccion: true, 
            telefono: true
          }
        }, 
        slot: {
          select: {
            id: true, 
            horaInicio: true, 
            horaFin: true, 
            duracionMinutos: true
          }
        }
      }
    });
  }

  /**
   * Create a new appointment with enhanced Redis distributed locking to prevent double-bookings
   */
  async createAppointment(data: CreateAppointmentDto): Promise<Cita> {
    // Generate a unique lock key based on doctor and time slot
    const resourceKey = `appointment:${data.doctorId}:${data.fechaHora.toISOString()}`;
    
    // Execute the appointment creation within a distributed lock
    return await RedisLockManager.executeWithLock(resourceKey,  async () => {
      // Perform atomic transaction to check availability and create appointment
      const appointment = await prisma.$transaction(async (tx) => {
        // Double-check availability within the transaction
        const conflictingAppointment = await tx.cita.findFirst({
          where: {
            doctorId: data.doctorId, 
            fechaHora: data.fechaHora, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (conflictingAppointment) {
          throw new Error(`El horario ${data.fechaHora.toISOString()} ya está ocupado para el médico ${data.doctorId}`);
        }

        // Check if the patient already has an appointment at this time
        const patientConflict = await tx.cita.findFirst({
          where: {
            pacienteId: data.pacienteId, 
            fechaHora: data.fechaHora, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (patientConflict) {
          throw new Error(`El paciente ${data.pacienteId} ya tiene una cita programada para ${data.fechaHora.toISOString()}`);
        }

        // Create the appointment
        return await tx.cita.create({
          data: {
            doctorId: data.doctorId,
            pacienteId: data.pacienteId,
            fechaHora: data.fechaHora,
            tipo: data.tipo,
            estado: 'programada', // Default to scheduled
            ubicacionId: data.ubicacionId,
            slotId: data.slotId
          }
        });
      });

      // Generate video link if it's a teleconsultation
      if (data.tipo=== 'teleconsulta') {
        await this.generateVideoLink(appointment.id);
      }

      return appointment;
    }, { timeout: 45, retryDelay: 200, maxRetries: 3 }); // Enhanced lock options
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(id: string,  data: UpdateAppointmentDto): Promise<Cita> {
    const existingAppointment = await this.getAppointmentById(id);

    if (!existingAppointment) {
      throw new Error('Cita no encontrada');
    }

    // If changing date/time, check for conflicts
    if (data.fechaHora && data.fechaHora.getTime() !== existingAppointment.fechaHora.getTime()) {
      const resourceKey = `appointment:${existingAppointment.doctorId}:${data.fechaHora.toISOString()}`;
      
      return await RedisLockManager.executeWithLock(resourceKey,  async () => {
        // Check for conflicts at the new time
        const conflictAtNewTime = await prisma.cita.findFirst({
          where: {
            doctorId: existingAppointment.doctorId, 
            fechaHora: data.fechaHora, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }, 
            id: {
              not: id // Exclude the current appointment
            }
          }
        });

        if (conflictAtNewTime) {
          throw new Error(`El nuevo horario ${data.fechaHora.toISOString()} ya está ocupado`);
        }

        // Also check for patient conflicts at new time
        const patientConflict = await prisma.cita.findFirst({
          where: {
            pacienteId: existingAppointment.pacienteId, 
            fechaHora: data.fechaHora, 
            estado: {
              in: ['programada',  'confirmada',  'en_progreso']
            }
          }
        });

        if (patientConflict) {
          throw new Error(`El paciente ya tiene una cita programada para ${data.fechaHora.toISOString()}`);
        }

        // Update the appointment
        const updatedAppointment = await prisma.cita.update({
          where: { id },
          data: {
            fechaHora: data.fechaHora,
            tipo: data.tipo? data.tipo as any: undefined,
            estado: data.estado as any,
            ubicacionId: data.ubicacionId
          }
        });

        // If it's now a teleconsultation and no video link exists, generate one
        if (data.tipo=== 'teleconsulta' && !existingAppointment.linkVideo) {
          await this.generateVideoLink(updatedAppointment.id);
        }

        return updatedAppointment;
      }, { timeout: 30, retryDelay: 150, maxRetries: 2 });
    } else {
      // Update without date change
      const updatedAppointment = await prisma.cita.update({
        where: { id },
        data: {
          tipo: data.tipo? data.tipo as any: undefined,
          estado: data.estado as any,
          ubicacionId: data.ubicacionId
        }
      });

      // If changing to teleconsulta and no video link exists, generate one
      if (data.tipo=== 'teleconsulta' && !existingAppointment.linkVideo) {
        await this.generateVideoLink(updatedAppointment.id);
      }

      return updatedAppointment;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(id: string,  cancelReason?: string): Promise<Cita> {
    const appointment = await this.getAppointmentById(id);
    
    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    // Check cancellation policy (24 hours advance notice)
    const hoursBefore = (appointment.fechaHora.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    
    if (hoursBefore < 24) {
      throw new Error('Las citas solo pueden cancelarse con al menos 24 horas de anticipación');
    }

    // Update appointment status to cancelled
    const cancelledAppointment = await prisma.cita.update({
      where: { id },
      data: {
        estado: 'cancelada',
        motivoCancelacion: cancelReason || 'Cancelación por el paciente'
      }
    });

    return cancelledAppointment;
  }

  /**
   * Reschedule an appointment to a new time
   */
  async rescheduleAppointment(id: string,  newDate: Date,  reason?: string): Promise<Cita> {
    const appointment = await this.getAppointmentById(id);

    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    // Acquire lock for the new time slot
    const resourceKey = `appointment:${appointment.doctorId}:${newDate.toISOString()}`;
    
    return await RedisLockManager.executeWithLock(resourceKey,  async () => {
      // Check for conflicts at the new time
      const conflictAtNewTime = await prisma.cita.findFirst({
        where: {
          doctorId: appointment.doctorId, 
          fechaHora: newDate, 
          estado: {
            in: ['programada',  'confirmada',  'en_progreso']
          }, 
          id: {
            not: id // Exclude the current appointment
          }
        }
      });

      if (conflictAtNewTime) {
        throw new Error(`El nuevo horario ${newDate.toISOString()} ya está ocupado`);
      }

      // Also check for patient conflicts at new time
      const patientConflict = await prisma.cita.findFirst({
        where: {
          pacienteId: appointment.pacienteId, 
          fechaHora: newDate, 
          estado: {
            in: ['programada',  'confirmada',  'en_progreso']
          }
        }
      });

      if (patientConflict) {
        throw new Error(`El paciente ya tiene una cita programada para ${newDate.toISOString()}`);
      }

      // Update the appointment with new date
      const rescheduledAppointment = await prisma.cita.update({
        where: { id },
        data: {
          fechaHora: newDate,
          estado: 'programada',  // Keep as programada when rescheduled
          motivoCancelacion: reason || `Reprogramada desde ${appointment.fechaHora.toISOString()}`
        }
      });

      return rescheduledAppointment;
    }, { timeout: 30, retryDelay: 150, maxRetries: 2 });
  }

  /**
   * Confirm an appointment
   */
  async confirmAppointment(id: string): Promise<Cita> {
    const appointment = await this.getAppointmentById(id);
    
    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    if (appointment.estado === 'cancelada') {
      throw new Error('No se puede confirmar una cita cancelada');
    }

    const confirmedAppointment = await prisma.cita.update({
      where: { id }, 
      data: {
        estado: 'confirmada'
      }
    });

    return confirmedAppointment;
  }

  /**
   * Get appointments for a specific day
   */
  async getAppointmentsForDay(doctorId: string,  date: Date): Promise<Cita[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0,  0,  0,  0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23,  59,  59,  999);

    return await prisma.cita.findMany({
      where: {
        doctorId, 
        fechaHora: {
          gte: startOfDay, 
          lte: endOfDay
        }, 
        estado: {
          not: 'cancelada'
        }
      }, 
      include: {
        paciente: {
          select: {
            id: true, 
            nombre: true, 
            cedula: true
          }
        }
      }, 
      orderBy: {
        fechaHora: 'asc'
      }
    });
  }

  /**
   * Get upcoming appointments for a doctor
   */
  async getUpcomingAppointments(doctorId: string,  limit = 5): Promise<Cita[]> {
    return await prisma.cita.findMany({
      where: {
        doctorId, 
        fechaHora: {
          gte: new Date()
        },
        estado: {
          not: 'cancelada'
        }
      },
      include: {
        paciente: {
          select: {
            id: true,
            nombre: true,
            cedula: true
          }
        }
      },
      orderBy: {
        fechaHora: 'asc'
      },
      take: limit
    });
  }

  /**
   * Private method to generate video conference link for teleconsultations
   */
  private async generateVideoLink(appointmentId: string): Promise<void> {
    // In a real implementation, this would integrate with Jitsi, Zoom, etc.
    // For now, we'll create a mock video link
    const videoLink = `https://meet.galeno.ec/${appointmentId}-${Date.now()}`;
    
    await prisma.cita.update({
      where: { id: appointmentId }, 
      data: { linkVideo: videoLink }
    });
  }
}