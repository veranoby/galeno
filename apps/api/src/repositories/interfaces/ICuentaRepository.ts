// apps/api/src/repositories/interfaces/ICuentaRepository.ts
/**
 * Interfaz del Repository de Cuentas
 * Define las operaciones de persistencia para Cuenta
 */

import { Cuenta, Prisma } from '@prisma/client';

export type CreateCuentaDTO = Prisma.CuentaCreateInput;
export type UpdateCuentaDTO = Prisma.CuentaUpdateInput;
export type CuentaFindOptions = {
  where?: Prisma.CuentaWhereInput;
  orderBy?: Prisma.CuentaOrderByWithRelationInput;
  limit?: number;
  offset?: number;
  include?: Prisma.CuentaInclude;
};

export interface ICuentaRepository {
  /**
   * Crea una nueva cuenta
   */
  create(data: CreateCuentaDTO): Promise<Cuenta>;

  /**
   * Busca cuentas por criterios
   */
  findMany(options?: CuentaFindOptions): Promise<Cuenta[]>;

  /**
   * Busca una cuenta por ID
   */
  findById(id: string, options?: CuentaFindOptions): Promise<Cuenta | null>;

  /**
   * Busca una cuenta por usuario ID
   */
  findByUsuario(usuarioId: string): Promise<Cuenta | null>;

  /**
   * Actualiza una cuenta
   */
  update(id: string, data: UpdateCuentaDTO): Promise<Cuenta>;

  /**
   * Actualiza el plan de una cuenta
   */
  updatePlan(cuentaId: string, plan: string, maxDoctores?: number): Promise<Cuenta>;

  /**
   * Actualiza los límites de uso de una cuenta
   */
  updateUsageLimits(cuentaId: string, consultasUsadas: number): Promise<Cuenta>;

  /**
   * Verifica si una cuenta puede realizar una consulta
   */
  canPerformConsulta(cuentaId: string): Promise<boolean>;

  /**
   * Obtiene el plan y límites de una cuenta
   */
  getPlanLimits(cuentaId: string): Promise<{
    plan: string;
    maxDoctores: number;
    maxAsistentes: number;
    consultasUsadas: number;
    consultasRestantes: number | null;
    fechaFinSuscripcion: Date | null;
  }>;

  /**
   * Busca cuentas que necesitan renovación
   */
  findExpiringSoon(daysBefore: number): Promise<Cuenta[]>;

  /**
   * Busca cuentas con plan específico
   */
  findByPlan(plan: string): Promise<Cuenta[]>;

  /**
   * Cuenta cuentas por plan
   */
  countByPlan(): Promise<Record<string, number>>;
}
