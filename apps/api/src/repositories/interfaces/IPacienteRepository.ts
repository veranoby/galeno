// apps/api/src/repositories/interfaces/IPacienteRepository.ts
/**
 * Interfaz del Repository de Pacientes
 * Define las operaciones de persistencia para Paciente
 */

import { Paciente, Prisma } from '@prisma/client';

export type CreatePacienteDTO = Prisma.PacienteCreateInput;
export type UpdatePacienteDTO = Prisma.PacienteUpdateInput;
export type PacienteFindOptions = {
  where?: Prisma.PacienteWhereInput;
  orderBy?: Prisma.PacienteOrderByWithRelationInput;
  limit?: number;
  offset?: number;
  include?: Prisma.PacienteInclude;
};

export interface IPacienteRepository {
  /**
   * Crea un nuevo paciente
   */
  create(data: CreatePacienteDTO): Promise<Paciente>;

  /**
   * Busca pacientes por criterios
   */
  findMany(options?: PacienteFindOptions): Promise<Paciente[]>;

  /**
   * Busca un paciente por ID
   */
  findById(id: string, options?: PacienteFindOptions): Promise<Paciente | null>;

  /**
   * Busca un paciente por cédula
   */
  findByCedula(cedula: string): Promise<Paciente | null>;

  /**
   * Busca pacientes por nombre o cédula (búsqueda)
   */
  search(query: string, options?: Omit<PacienteFindOptions, 'where'>): Promise<Paciente[]>;

  /**
   * Busca pacientes de un doctor
   */
  findByDoctor(doctorId: string, options?: Omit<PacienteFindOptions, 'where'>): Promise<Paciente[]>;

  /**
   * Actualiza un paciente
   */
  update(id: string, data: UpdatePacienteDTO): Promise<Paciente>;

  /**
   * Elimina un paciente (soft delete recomendado)
   */
  delete(id: string): Promise<Paciente>;

  /**
   * Cuenta pacientes por criterios
   */
  count(options?: PacienteFindOptions): Promise<number>;

  /**
   * Verifica si un paciente existe por cédula
   */
  existsByCedula(cedula: string): Promise<boolean>;

  /**
   * Obtiene pacientes con Health Wallet activo
   */
  findWithActiveHealthWallet(options?: Omit<PacienteFindOptions, 'where'>): Promise<Paciente[]>;

  /**
   * Obtiene conexiones activas de un paciente
   */
  findActiveConnections(pacienteId: string): Promise<Paciente[]>;
}
