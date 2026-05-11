export interface CitaSlot {
  inicio: Date;
  fin: Date;
  tipo: 'presencial' | 'teleconsulta';
  duracion: number;
}

export interface CrearReservaDto {
  doctorId: string;
  pacienteId: string;
  slotId?: string;
  fechaHora: Date;
  tipo: 'presencial' | 'teleconsulta';
  ubicacionId?: string;
}

export interface DisponibilidadQuery {
  doctorId: string;
  fecha: Date;
  tipo?: 'presencial' | 'teleconsulta';
}