import type { Cita } from '@galeno/shared-types';

export function transformarCitaParaFrontend(cita: any): Cita {
  if (!cita) return null as any;

  const fechaHora = cita.fechaHora instanceof Date
    ? cita.fechaHora
    : new Date(cita.fechaHora);

  const duracion = cita.slot?.duracionMinutos || cita.duracion || 30;
  const horaFinDate = new Date(fechaHora.getTime() + duracion * 60000);

  return {
    ...cita,
    titulo: cita.paciente?.nombre || 'Cita sin paciente',
    fecha: formatearFechaISO(fechaHora),
    horaInicio: formatearHora(fechaHora),
    horaFin: formatearHora(horaFinDate),
    pacienteNombre: cita.paciente?.nombre || cita.pacienteNombre || '',
    duracion: duracion,
    notas: cita.notas || '',
    recordatorioEnviado: cita.notificadaDoctor || cita.recordatorioEnviado || false,
  };
}

export function transformarCitasParaFrontend(citas: any[]): Cita[] {
  if (!Array.isArray(citas)) return [];
  return citas.map(transformarCitaParaFrontend);
}

function formatearFechaISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0];
}

function formatearHora(fecha: Date): string {
  const hours = String(fecha.getHours()).padStart(2, '0');
  const minutes = String(fecha.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
