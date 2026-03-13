// apps/api/src/repositories/interfaces/IPagoRepository.ts
/**
 * Interfaz del Repository de Pagos
 * Define las operaciones de persistencia para Pago
 */

import { Pago, Prisma } from '@prisma/client';

export type CreatePagoDTO = Prisma.PagoCreateInput;
export type UpdatePagoDTO = Prisma.PagoUpdateInput;
export type PagoFindOptions = {
  where?: Prisma.PagoWhereInput;
  orderBy?: Prisma.PagoOrderByWithRelationInput;
  limit?: number;
  offset?: number;
  include?: Prisma.PagoInclude;
};

export interface IPagoRepository {
  /**
   * Crea un nuevo pago
   */
  create(data: CreatePagoDTO): Promise<Pago>;

  /**
   * Busca pagos por criterios
   */
  findMany(options?: PagoFindOptions): Promise<Pago[]>;

  /**
   * Busca un pago por ID
   */
  findById(id: string, options?: PagoFindOptions): Promise<Pago | null>;

  /**
   * Busca pagos de un paciente
   * Nota: El modelo Pago no tiene pacienteId, este método lanza error
   */
  findByPaciente(pacienteId: string, options?: Omit<PagoFindOptions, 'where'>): Promise<Pago[]>;

  /**
   * Busca pagos de una cuenta
   */
  findByCuenta(cuentaId: string, options?: Omit<PagoFindOptions, 'where'>): Promise<Pago[]>;

  /**
   * Busca pagos en un rango de fechas
   */
  findByDateRange(startDate: Date, endDate: Date, options?: Omit<PagoFindOptions, 'where'>): Promise<Pago[]>;

  /**
   * Actualiza un pago
   */
  update(id: string, data: UpdatePagoDTO): Promise<Pago>;

  /**
   * Actualiza el estado de un pago
   */
  updateStatus(id: string, status: string, metadata?: Record<string, unknown>): Promise<Pago>;

  /**
   * Cuenta pagos por criterios
   */
  count(options?: PagoFindOptions): Promise<number>;

  /**
   * Obtiene suma de pagos por estado
   */
  sumByStatus(cuentaId?: string, startDate?: Date, endDate?: Date): Promise<{
    pendiente: number;
    completado: number;
    fallido: number;
    reembolsado: number;
  }>;

  /**
   * Busca pagos que necesitan reintentar procesamiento
   */
  findPendingRetry(): Promise<Pago[]>;

  /**
   * Busca pagos por external ID (para webhooks)
   */
  findByExternalId(externalId: string): Promise<Pago | null>;

  /**
   * Obtiene métricas de pagos de una cuenta
   */
  getCuentaMetrics(cuentaId: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    recaudado: number;
    pendiente: number;
    tasaCompletado: number;
  }>;
}
