// @galeno/shared-types
// Tipos TypeScript compartidos entre frontend y backend

// ============= DOMINIOS =============

export enum Rol {
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum RolVinculado {
  ASISTENTE = 'ASISTENTE',
  ENFERMERA = 'ENFERMERA',
}

export enum Plan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  CLINICA_SME = 'CLINICA_SME',
  ENTERPRISE = 'ENTERPRISE',
}

// ============= CONSULTA =============

export enum EstadoConsulta {
  BORRADOR = 'borrador',
  TRIAJE = 'triaje',
  PENDIENTE = 'pendiente',
  EN_ATENCION = 'en_atencion',
  FINALIZADA = 'finalizada',
  INTERCONSULTA = 'interconsulta',
}

export enum TipoAntecedente {
  PERSONAL = 'personal',
  FAMILIAR = 'familiar',
  MEDICAMENTO = 'medicamento',
  HABITO = 'habito',
  ALERGIA = 'alergia',
}

// ============= DOCUMENTOS =============

export enum TipoDocumento {
  RECETA = 'receta',
  EXAMEN = 'examen',
  CERTIFICADO = 'certificado',
  DIAGNOSTICO = 'diagnostico',
}

export enum EstadoDocumento {
  ACTIVO = 'activo',
  CADUCADO = 'caducado',
  ANULADO = 'anulado',
}

// ============= AGENDA =============

export enum TipoCita {
  PRESENCIAL = 'presencial',
  TELECONSULTA = 'teleconsulta',
}

export enum EstadoCita {
  PROGRAMADA = 'programada',
  CONFIRMADA = 'confirmada',
  EN_PROGRESO = 'en_progreso',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada',
  NO_PRESENTO = 'no_presento',
}

// ============= IA =============

export interface IASuggestion {
  id: string;
  categoria: 'diagnostico' | 'medicamento' | 'examen' | 'alerta';
  color: '#2196F3' | '#4CAF50' | '#FFC107' | '#F44336';
  contenido: string;
  metadata?: Record<string, unknown>;
}

// ============= HEALTH WALLET =============

export interface HealthWallet {
  id: string;
  pacienteId: string;
  autorizaciones: Autorizacion[];
}

export interface Autorizacion {
  doctorId: string;
  tipo: 'autorizadoPor' | 'representante_legal';
  fechaAutorizacion: Date;
  revocadaEn?: Date;
}

// ============= RESPUESTAS API =============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
