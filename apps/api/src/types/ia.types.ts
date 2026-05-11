// apps/api/src/types/ia.types.ts
export interface AntecedentePaciente {
  id: string;
  tipo: string;
  categoria?: string;
  detalle: string;
  descripcion?: string; // Alias para detalle (compatibilidad)
  grado?: string;
  fechaRegistro: Date;
}

export interface ConsultaContext {
  pacienteId: string;
  antecedentes: AntecedentePaciente[];
  medicamentosActivos: Medicamento[];
  alergias: string[];
}

export interface Medicamento {
  id: string;
  nombre: string;
  principioActivo: string;
  concentracion: string;
  formaFarmaceutica: string;
  viaAdministracion: string;
  frecuencia: string;
  duracion: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
}

export interface MedicamentoSugerido {
  nombre: string;
  principioActivo: string;
  concentracion: string;
  formaFarmaceutica: string;
  viaAdministracion: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  tipo: 'generico' | 'marca';
}

export interface ExamenSugerido {
  nombre: string;
  descripcion: string;
  urgencia: 'alta' | 'media' | 'baja';
  notas?: string;
}

export interface AlertaSugerida {
  mensaje: string;
  tipo: 'contraindicacion' | 'precaucion' | 'interaccion' | 'duplicado';
  severidad: 'baja' | 'media' | 'alta';
}