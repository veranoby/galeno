// @galeno/shared-types
// Tipos TypeScript compartidos entre frontend y backend

// ============= ROLES =============
export enum Rol {
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum RolVinculado {
  ASISTENTE = 'ASISTENTE',
  ENFERMERA = 'ENFERMERA',
}

// ============= PLANES =============
export enum Plan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  CLINICA = 'CLINICA',
  ENTERPRISE = 'ENTERPRISE',
}

// ============= ENUMS ADICIONALES =============
export enum RegistradoPor {
  paciente = 'paciente',
  enfermera = 'enfermera',
  doctor = 'doctor',
}

export enum TipoAntecedente {
  personal = 'personal',
  familiar = 'familiar',
  medicamento = 'medicamento',
  habito = 'habito',
  alergia = 'alergia',
}

export enum EstadoConsulta {
  BORRADOR = 'borrador',
  TRIAJE = 'triaje',
  PENDIENTE = 'pendiente',
  EN_ATENCION = 'en_atencion',
  FINALIZADA = 'finalizada',
  INTERCONSULTA = 'interconsulta',
}

export enum TipoDocumento {
  RECETA = 'receta',
  EXAMEN = 'examen',
  CERTIFICADO = 'certificado',
}

export enum EstadoDocumento {
  ACTIVO = 'activo',
  CADUCADO = 'caducado',
  ANULADO = 'anulado',
}

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

export enum AutorizadoPor {
  paciente = 'paciente',
  representante_legal = 'representante_legal',
}

export enum EstadoConexion {
  ACTIVA = 'activa',
  REVOCADA = 'revocada',
}

export enum EstadoArticulo {
  PENDIENTE = 'pendiente',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
}

export enum TipoInterconsulta {
  BASICA = 'basica',
  DERIVACION_DIGITAL = 'derivacion_digital',
}

export enum EstadoInterconsulta {
  PENDIENTE = 'pendiente',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  COMPLETADA = 'completada',
}

export enum UserType {
  CUENTA = 'CUENTA',
  USUARIO_VINCULADO = 'USUARIO_VINCULADO',
}

export enum RegistradoPor {
  DOCTOR = 'doctor',
  ASISTENTE = 'asistente',
  ENFERMERA = 'enfermera',
}

export enum EstadoDocumento {
  FIRMANDO = 'firmado',
  NO_FIRMADO = 'no_firmado',
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

// ============= ONBOARDING =============
export enum OnboardingStep {
  WELCOME = 'welcome',
  EMAIL_VERIFICATION = 'email_verification',
  PROFILE_SETUP = 'profile_setup',
  TUTORIAL = 'tutorial',
  COMPLETED = 'completed',
}

// Type para cuando OnboardingStep se importa como valor
export type OnboardingStepValue = OnboardingStep;

export enum EmailVerificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  emailVerified: boolean;
  profileCompleted: boolean;
  tutorialCompleted: boolean;
  startedAt?: Date;
  completedAt?: Date;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  expiresAt: string;
  token: string;
}

export interface ProfileSetupData {
  especialidad: string;
  subespecialidad?: string;
  numeroLicencia: string;
  consultorio: string;
  telefono: string;
  direccion: {
    nombre: string;
    ciudad: string;
    provincia: string;
    telefono?: string;
  };
  preferencias: {
    idioma: 'es' | 'en';
    formatoHora: '12h' | '24h';
    zonaHoraria: string;
    notificaciones: boolean;
  };
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
  image?: string;
}

// ============= CONSULTA FILTERS =============
export interface ConsultaFilters {
  estado?: EstadoConsulta;
  pacienteId?: string;
  pacienteNombre?: string;
  pacienteCedula?: string;
  doctorId?: string;
  doctorNombre?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  firmado?: boolean;
  busquedaGeneral?: string;
  ordenarPor?: 'fecha' | 'paciente' | 'doctor' | 'estado';
  orden?: 'asc' | 'desc';
  pagina?: number;
  limite?: number;
}

// ============= FIRMA DIGITAL =============
export enum FirmaDigitalState {
  /** Estado inicial, sin certificado cargado */
  IDLE = 'idle',

  /** Certificado cargado y listo para firmar */
  CERTIFICADO_CARGADO = 'certificado_cargado',

  /** Proceso de firma en curso */
  FIRMANDO = 'firmando',

  /** Firma completada exitosamente */
  FIRMADO = 'firmado',

  /** Error durante el proceso */
  ERROR = 'error',

  /** Firma validándose en servidor */
  VALIDANDO = 'validando',

  /** Firma validada exitosamente */
  VALIDADO = 'validado',
}

export interface CertificadoInfo {
  /** Subject DN del certificado X.509 */
  subject: string;

  /** Issuer DN del certificado */
  issuer: string;

  /** Número de serie del certificado */
  serialNumber: string;

  /** Fecha de inicio de validez */
  validFrom: Date;

  /** Fecha de fin de validez */
  validTo: Date;

  /** Common Name (CN del certificado - nombre del firmante) */
  cn: string;

  /** Email del titular (opcional) */
  email?: string;

  /** Cédula ecuatoriana (OID 2.5.4.45) */
  cedula?: string;
}

export interface ResultadoFirma {
  /** XML completo con la firma XAdES-BES incrustada */
  xmlFirmado: string;

  /** Valor de la firma en formato Base64 */
  firmaBase64: string;

  /** Certificado utilizado en formato Base64 (DER) */
  certificadoBase64: string;

  /** Timestamp de cuando se creó la firma */
  timestamp: Date;

  /** Nombre del firmante (extraído del certificado) */
  firmante: string;
}

export interface ResultadoValidacion {
  /** Indica si la firma es válida */
  valido: boolean;

  /** Mensaje descriptivo del resultado */
  mensaje: string;

  /** Nombre del firmante verificado (si aplica) */
  firmante?: string;

  /** Fecha en que se realizó la validación */
  fechaFirma?: Date;

  /** Indica si el certificado está vigente */
  certificadoVigente?: boolean;
}

export interface DatosConsulta {
  /** ID único de la consulta */
  id: string;

  /** ID del paciente */
  pacienteId: string;

  /** Nombre completo del paciente */
  pacienteNombre: string;

  /** Cédula del paciente */
  pacienteCedula: string;

  /** Nombre del doctor que atiende */
  doctorNombre: string;

  /** Motivo de la consulta */
  motivoConsulta?: string;

  /** Diagnóstico (CIE-10) */
  diagnostico?: string;

  /** Fecha en que se realizó la consulta */
  fecha: Date;
}

// ============= RESPONSES API =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
  };
}
