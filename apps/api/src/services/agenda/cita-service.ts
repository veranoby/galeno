import prisma from '../../config/database.js';
import { Cita, EstadoCita, Prisma } from '@prisma/client';

export type CitaWithRelations = Prisma.CitaGetPayload<{
  include: {
    doctor: {
      select: {
        nombre: true;
        email: true;
      };
    };
    paciente: {
      select: {
        nombre: true;
        cedula: true;
        email: true;
      };
    };
    ubicacion: true;
    slot: true;
  };
}>;

export interface CrearCitaDto {
  doctorId: string;
  pacienteId: string;
  ubicacionId?: string;
  slotId?: string;
  fechaHora: Date;
  tipo: 'presencial' | 'teleconsulta';
  estado?: EstadoCita;
}

export interface ActualizarCitaDto {
  ubicacionId?: string;
  slotId?: string;
  fechaHora?: Date;
  tipo?: 'presencial' | 'teleconsulta';
  estado?: EstadoCita;
  motivoCancelacion?: string;
}

export async function crearCita(data: CrearCitaDto): Promise<Cita> {
  return prisma.cita.create({
    data: {
      doctorId: data.doctorId, 
      pacienteId: data.pacienteId, 
      ubicacionId: data.ubicacionId, 
      slotId: data.slotId, 
      fechaHora: data.fechaHora, 
      tipo: data.tipo,
      estado: data.estado || 'programada'
    }
  });
}

export async function obtenerCitaPorId(id: string): Promise<CitaWithRelations | null> {
  return prisma.cita.findUnique({
    where: { id }, 
    include: {
      doctor: {
        select: {
          nombre: true, 
          email: true
        }
      }, 
      paciente: {
        select: {
          nombre: true, 
          cedula: true, 
          email: true
        }
      }, 
      ubicacion: true, 
      slot: true
    }
  }) as Promise<CitaWithRelations | null>;
}

export async function obtenerCitasPorDoctor(
  doctorId: string, 
  estado?: EstadoCita, 
  fechaDesde?: Date, 
  fechaHasta?: Date
): Promise<Cita[]> {
  const whereClause: any = { doctorId };
  
  if (estado) {
    whereClause.estado = estado;
  }
  
  if (fechaDesde || fechaHasta) {
    whereClause.fechaHora = {};
    if (fechaDesde) whereClause.fechaHora.gte = fechaDesde;
    if (fechaHasta) whereClause.fechaHora.lte = fechaHasta;
  }

  return prisma.cita.findMany({
    where: whereClause, 
    orderBy: { fechaHora: 'asc' }, 
    include: {
      paciente: {
        select: {
          nombre: true, 
          cedula: true, 
          telefono: true
        }
      }, 
      ubicacion: true, 
      slot: true
    }
  });
}

export async function obtenerCitasPorPaciente(
  pacienteId: string, 
  estado?: EstadoCita, 
  fechaDesde?: Date, 
  fechaHasta?: Date
): Promise<Cita[]> {
  const whereClause: any = { pacienteId };
  
  if (estado) {
    whereClause.estado = estado;
  }
  
  if (fechaDesde || fechaHasta) {
    whereClause.fechaHora = {};
    if (fechaDesde) whereClause.fechaHora.gte = fechaDesde;
    if (fechaHasta) whereClause.fechaHora.lte = fechaHasta;
  }

  return prisma.cita.findMany({
    where: whereClause, 
    orderBy: { fechaHora: 'asc' }, 
    include: {
      doctor: {
        select: {
          nombre: true, 
          especialidad: true
        }
      }, 
      ubicacion: true, 
      slot: true
    }
  });
}

export async function actualizarCita(
  id: string, 
  data: ActualizarCitaDto
): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      ...data, 
      tipo: data.tipo? data.tipo: undefined,
    }
  });
}

export async function eliminarCita(id: string): Promise<Cita> {
  // Considerar soft delete en lugar de eliminación física
  return prisma.cita.delete({
    where: { id }
  });
}

export async function cancelarCita(
  id: string, 
  motivo?: string
): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      estado: 'cancelada', 
      motivoCancelacion: motivo
    }
  });
}

export async function confirmarCita(id: string): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      estado: 'confirmada'
    }
  });
}

export async function iniciarCita(id: string): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      estado: 'en_progreso'
    }
  });
}

export async function completarCita(id: string): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      estado: 'completada'
    }
  });
}

export async function marcarNoPresento(id: string): Promise<Cita> {
  return prisma.cita.update({
    where: { id }, 
    data: {
      estado: 'no_presento'
    }
  });
}

export async function obtenerCitasProximas(
  doctorId: string, 
  horas: number = 24
): Promise<Cita[]> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + horas * 60 * 60 * 1000);

  return prisma.cita.findMany({
    where: {
      doctorId, 
      fechaHora: {
        gte: ahora, 
        lte: limite
      }, 
      estado: {
        in: ['programada',  'confirmada']
      }
    }, 
    orderBy: { fechaHora: 'asc' }, 
    include: {
      paciente: {
        select: {
          nombre: true, 
          cedula: true, 
          telefono: true
        }
      }, 
      ubicacion: true
    }
  });
}

export async function obtenerEstadisticasCitas(doctorId: string): Promise<{
  total: number;
  programadas: number;
  confirmadas: number;
  completadas: number;
  canceladas: number;
}> {
  const total = await prisma.cita.count({ where: { doctorId } });
  const programadas = await prisma.cita.count({ 
    where: { doctorId,  estado: 'programada' } 
  });
  const confirmadas = await prisma.cita.count({ 
    where: { doctorId,  estado: 'confirmada' } 
  });
  const completadas = await prisma.cita.count({ 
    where: { doctorId,  estado: 'completada' } 
  });
  const canceladas = await prisma.cita.count({ 
    where: { doctorId,  estado: 'cancelada' } 
  });

  return {
    total,
    programadas,
    confirmadas,
    completadas,
    canceladas
  };
}