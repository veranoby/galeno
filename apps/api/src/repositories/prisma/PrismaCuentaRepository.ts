// apps/api/src/repositories/prisma/PrismaCuentaRepository.ts
/**
 * Implementación del Repository de Cuentas con Prisma
 */

import { ICuentaRepository, CreateCuentaDTO, UpdateCuentaDTO, CuentaFindOptions } from '../interfaces/ICuentaRepository';
import { Cuenta, PrismaClient } from '@prisma/client';

export class PrismaCuentaRepository implements ICuentaRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCuentaDTO): Promise<Cuenta> {
    return await this.prisma.cuenta.create({ data });
  }

  async findMany(options: CuentaFindOptions = {}): Promise<Cuenta[]> {
    const { where, orderBy, limit, offset, include } = options;
    return await this.prisma.cuenta.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
    });
  }

  async findById(id: string, options: CuentaFindOptions = {}): Promise<Cuenta | null> {
    const { include } = options;
    return await this.prisma.cuenta.findUnique({
      where: { id },
      include,
    });
  }

  async findByUsuario(usuarioId: string): Promise<Cuenta | null> {
    return await this.prisma.cuenta.findUnique({
      where: { id: usuarioId },
    });
  }

  async update(id: string, data: UpdateCuentaDTO): Promise<Cuenta> {
    return await this.prisma.cuenta.update({
      where: { id },
      data,
    });
  }

  async updatePlan(cuentaId: string, plan: string, maxDoctores?: number): Promise<Cuenta> {
    return await this.prisma.cuenta.update({
      where: { id: cuentaId },
      data: {
        plan: plan as any,
        ...(maxDoctores !== undefined && { maxDoctores }),
      },
    });
  }

  async updateUsageLimits(cuentaId: string, consultasUsadas: number): Promise<Cuenta> {
    // Nota: Este método está obsoleto ya que el modelo Cuenta no tiene consultasUsadas
    // Se mantiene para compatibilidad con la interfaz
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: { maxDoctores: true },
    });

    if (!cuenta) throw new Error('Cuenta no encontrada');

    // No hay límite de consultas en el modelo actual, así que siempre puede realizar
    return this.findById(cuentaId);
  }

  async canPerformConsulta(cuentaId: string): Promise<boolean> {
    // En el modelo actual, no hay límite de consultas
    // Siempre puede realizar consultas
    return true;
  }

  async getPlanLimits(cuentaId: string): Promise<{
    plan: string;
    maxDoctores: number;
    maxAsistentes: number;
    consultasUsadas: number;
    consultasRestantes: number | null;
    fechaFinSuscripcion: Date | null;
  }> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: {
        plan: true,
        maxDoctores: true,
        maxAsistentes: true,
        fechaFinSuscripcion: true,
      },
    });

    if (!cuenta) throw new Error('Cuenta no encontrada');

    // No hay contador de consultas en el modelo actual
    return {
      plan: cuenta.plan,
      maxDoctores: cuenta.maxDoctores,
      maxAsistentes: cuenta.maxAsistentes,
      consultasUsadas: 0,
      consultasRestantes: null,
      fechaFinSuscripcion: cuenta.fechaFinSuscripcion,
    };
  }

  async findExpiringSoon(daysBefore: number): Promise<Cuenta[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysBefore);

    return await this.prisma.cuenta.findMany({
      where: {
        fechaFinSuscripcion: {
          lte: expirationDate,
        },
      },
      include: {
        // No hay relación usuario en el modelo actual
      },
    });
  }

  async findByPlan(plan: string): Promise<Cuenta[]> {
    return await this.prisma.cuenta.findMany({
      where: { plan: plan as any },
    });
  }

  async countByPlan(): Promise<Record<string, number>> {
    const cuentas = await this.prisma.cuenta.groupBy({
      by: ['plan'],
      _count: true,
    });

    return cuentas.reduce((acc, item) => {
      acc[item.plan] = item._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
