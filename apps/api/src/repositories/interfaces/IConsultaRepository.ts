// apps/api/src/repositories/interfaces/IConsultaRepository.ts
/**
 * Interfaz del Repository de Consultas
 * Define las operaciones de persistencia para Consulta
 */

import { Consulta, Prisma } from '@prisma/client';

export type CreateConsultaDTO = Prisma.ConsultaCreateInput;
export type UpdateConsultaDTO = Prisma.ConsultaUpdateInput;
export type ConsultaFindOptions = {
  where?: Prisma.ConsultaWhereInput;
  orderBy?: Prisma.ConsultaOrderByWithRelationInput;
  limit?: number;
  offset?: number;
  include?: Prisma.ConsultaInclude;
};

export interface IConsultaRepository {
  /**
   * Crea una nueva consulta
   */
  create(data: CreateConsultaDTO): Promise<Consulta>;

  /**
   * Busca consultas por criterios
   */
  findMany(options?: ConsultaFindOptions): Promise<Consulta[]>;

  /**
   * Busca consultas de un paciente
   */
  findByPaciente(pacienteId: string, options?: Omit<ConsultaFindOptions, 'where'>): Promise<Consulta[]>;

  /**
   * Busca consultas de un doctor
   */
  findByDoctor(doctorId: string, options?: Omit<ConsultaFindOptions, 'where'>): Promise<Consulta[]>;

  /**
   * Busca consultas en un rango de fechas
   */
  findByDateRange(startDate: Date, endDate: Date, options?: Omit<ConsultaFindOptions, 'where'>): Promise<Consulta[]>;

  /**
   * Busca una consulta por ID
   */
  findById(id: string, options?: ConsultaFindOptions): Promise<Consulta | null>;

  /**
   * Actualiza una consulta
   */
  update(id: string, data: UpdateConsultaDTO): Promise<Consulta>;

  /**
   * Actualiza múltiples consultas
   */
  updateMany(where: Prisma.ConsultaWhereInput, data: UpdateConsultaDTO): Promise<{ count: number }>;

  /**
   * Elimina una consulta (soft delete recomendado)
   */
  delete(id: string): Promise<Consulta>;

  /**
   * Cuenta consultas por criterios
   */
  count(options?: ConsultaFindOptions): Promise<number>;

  /**
   * Obtiene estadísticas de consultas de un doctor
   */
  getDoctorStats(doctorId: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    completadas: number;
    canceladas: number;
    pendientes: number;
  }>;

  /**
   * Obtiene consultas que necesitan firma
   */
  findPendingSignature(doctorId: string): Promise<Consulta[]>;
}
