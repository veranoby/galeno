export type TipoInterconsulta = 'basica' | 'derivacion_digital';
export type EstadoInterconsulta = 'pendiente' | 'aceptada' | 'rechazada' | 'completada';

export interface Interconsulta {
  id: string;
  consultaId: string;
  solicitante: string;
  destino: string;
  tipo: TipoInterconsulta;
  estado: EstadoInterconsulta;
  mensaje?: string;
  respuesta?: string;
  respondidaEn?: string | Date;
  createdAt: string | Date;
  consulta?: any;
  destinoDoctor?: {
    nombre: string;
  };
}
