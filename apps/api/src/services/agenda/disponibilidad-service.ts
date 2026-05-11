import prisma from '../../config/database.js';
import { SlotDisponibilidad } from '@prisma/client';

export interface CrearSlotDto {
  doctorId: string;
  ubicacionId?: string;
  diaSemana: number; // 0-6 (Domingo-Sábado)
  horaInicio: string; // "09:00"
  horaFin: string;   // "17:00"
  duracionMinutos: number;
  tipo: 'presencial' | 'teleconsulta';
}

export interface CitaSlot {
  inicio: Date;
  fin: Date;
  tipo: 'presencial' | 'teleconsulta';
  duracion: number;
}

export async function crearSlot(data: CrearSlotDto): Promise<SlotDisponibilidad> {
  // Validar superposición de horarios
  const superpuestos = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM slots_disponibilidad
    WHERE doctor_id = ${data.doctorId}
      AND dia_semana = ${data.diaSemana}
      AND activo = true
      AND (
        (hora_inicio < ${data.horaFin} AND hora_fin > ${data.horaInicio})
      )
      AND id != COALESCE(${data['id']},  '')  -- Ignorar el mismo slot si estamos actualizando
  `;

  if (superpuestos.length > 0) {
    throw new Error('El horario se superpone con un slot existente');
  }

  return prisma.slotDisponibilidad.create({
    data: {
      doctorId: data.doctorId, 
      ubicacionId: data.ubicacionId, 
      diaSemana: data.diaSemana, 
      horaInicio: data.horaInicio, 
      horaFin: data.horaFin, 
      duracionMinutos: data.duracionMinutos, 
      tipo: data.tipo,
    }
  });
}

export async function actualizarSlot(id: string,  data: Partial<CrearSlotDto>): Promise<SlotDisponibilidad> {
  // Si se están actualizando los horarios, validar superposición
  if (data.horaInicio || data.horaFin || data.diaSemana) {
    const slotExistente = await prisma.slotDisponibilidad.findUnique({
      where: { id }
    });

    if (!slotExistente) {
      throw new Error('Slot no encontrado');
    }

    const horaInicio = data.horaInicio || slotExistente.horaInicio;
    const horaFin = data.horaFin || slotExistente.horaFin;
    const diaSemana = data.diaSemana !== undefined ? data.diaSemana : slotExistente.diaSemana;

    // Validar superposición con otros slots
    const superpuestos = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM slots_disponibilidad
      WHERE doctor_id = ${slotExistente.doctorId}
        AND dia_semana = ${diaSemana}
        AND activo = true
        AND id != ${id}
        AND (
          (hora_inicio < ${horaFin} AND hora_fin > ${horaInicio})
        )
    `;

    if (superpuestos.length > 0) {
      throw new Error('El horario se superpone con un slot existente');
    }
  }

  return prisma.slotDisponibilidad.update({
    where: { id }, 
    data: {
      ...data, 
      tipo: data.tipo? data.tipo: undefined,
    }
  });
}

export async function eliminarSlot(id: string): Promise<SlotDisponibilidad> {
  return prisma.slotDisponibilidad.delete({
    where: { id }
  });
}

export async function obtenerSlotsPorDoctor(doctorId: string): Promise<SlotDisponibilidad[]> {
  return prisma.slotDisponibilidad.findMany({
    where: {
      doctorId, 
      activo: true
    }, 
    orderBy: [
      { diaSemana: 'asc' }, 
      { horaInicio: 'asc' }
    ]
  });
}

export async function obtenerSlotsPorUbicacion(ubicacionId: string): Promise<SlotDisponibilidad[]> {
  return prisma.slotDisponibilidad.findMany({
    where: {
      ubicacionId, 
      activo: true
    }, 
    orderBy: [
      { diaSemana: 'asc' }, 
      { horaInicio: 'asc' }
    ]
  });
}

export async function obtenerSlotPorId(id: string): Promise<SlotDisponibilidad | null> {
  return prisma.slotDisponibilidad.findUnique({
    where: { id }
  });
}

export async function obtenerSlotsDisponibles(
  doctorId: string, 
  fecha: Date
): Promise<CitaSlot[]> {
  // Obtener slots del doctor para el día de la semana
  const diaSemana = fecha.getDay();

  const slots = await prisma.slotDisponibilidad.findMany({
    where: {
      doctorId, 
      diaSemana, 
      activo: true
    }
  });

  // Obtener citas ya ocupadas en esa fecha
  const inicioDia = new Date(fecha);
  inicioDia.setHours(0,  0,  0,  0);
  const finDia = new Date(fecha);
  finDia.setHours(23,  59,  59,  999);

  const citasOcupadas = await prisma.cita.findMany({
    where: {
      doctorId, 
      fechaHora: {
        gte: inicioDia, 
        lte: finDia
      }, 
      estado: {
        in: ['programada',  'confirmada',  'en_progreso']
      }
    }
  });

  // Generar slots disponibles
  const slotsDisponibles: CitaSlot[] = [];

  for (const slot of slots) {
    const [horaInicio, minInicio] = slot.horaInicio.split(':').map(Number);
    const [horaFin, minFin] = slot.horaFin.split(':').map(Number);

    let tiempoActual = new Date(fecha);
    tiempoActual.setHours(horaInicio,  minInicio,  0,  0);

    const tiempoFinal = new Date(fecha);
    tiempoFinal.setHours(horaFin,  minFin,  0,  0);

    while (tiempoActual < tiempoFinal) {
      const tiempoFinSlot = new Date(
        tiempoActual.getTime() + slot.duracionMinutos * 60000
      );

      // Verificar si este slot está ocupado
      const ocupado = citasOcupadas.some(cita => {
        const citaInicio = new Date(cita.fechaHora);
        const citaFin = new Date(
          citaInicio.getTime() + slot.duracionMinutos * 60000
        );
        return (
          (citaInicio <= tiempoActual && citaFin > tiempoActual) ||
          (citaInicio >= tiempoActual && citaInicio < tiempoFinSlot)
        );
      });

      if (!ocupado && tiempoFinSlot <= tiempoFinal) {
        slotsDisponibles.push({
          inicio: new Date(tiempoActual),
          fin: tiempoFinSlot,
          tipo: slot.tipo.toLowerCase() as 'presencial' | 'teleconsulta',
          duracion: slot.duracionMinutos
        });
      }

      tiempoActual = tiempoFinSlot;
    }
  }

  return slotsDisponibles;
}

export async function desactivarSlot(id: string): Promise<SlotDisponibilidad> {
  return prisma.slotDisponibilidad.update({
    where: { id }, 
    data: { activo: false }
  });
}