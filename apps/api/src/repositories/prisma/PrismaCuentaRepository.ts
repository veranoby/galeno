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
      where: { usuarioId },
    });
  }

  async update(id: string, data: UpdateCuentaDTO): Promise<Cuenta> {
    return await this.prisma.cuenta.update({
      where: { id },
      data,
    });
  }

  async updatePlan(cuentaId: string, plan: string, limiteConsultas?: number): Promise<Cuenta> {
    return await this.prisma.cuenta.update({
      where: { id: cuentaId },
      data: {
        plan,
        ...(limiteConsultas !== undefined && { limiteConsultas }),
      },
    });
  }

  async updateUsageLimits(cuentaId: string, consultasUsadas: number): Promise<Cuenta> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: { limiteConsultas: true },
    });

    if (!cuenta) throw new Error('Cuenta no encontrada');

    // Si no hay límite, no actualizamos
    if (cuenta.limiteConsultas === null) return this.findById(cuentaId);

    return await this.prisma.cuenta.update({
      where: { id: cuentaId },
      data: { consultasUsadas },
    });
  }

  async canPerformConsulta(cuentaId: string): Promise<boolean> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: {
        limiteConsultas: true,
        consultasUsadas: true,
        renovacionAt: true,
      },
    });

    if (!cuenta) return false;

    // Si no hay límite, puede realizar consultas
    if (cuenta.limiteConsultas === null) return true;

    // Verificar si no ha excedido el límite
    return cuenta.consultasUsadas < cuenta.limiteConsultas;
  }

  async getPlanLimits(cuentaId: string): Promise<{
    plan: string;
    limiteConsultas: number | null;
    consultasUsadas: number;
    consultasRestantes: number | null;
    renovacionAt: Date | null;
  }> {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: {
        plan: true,
        limiteConsultas: true,
        consultasUsadas: true,
        renovacionAt: true,
      },
    });

    if (!cuenta) throw new Error('Cuenta no encontrada');

    const consultasRestantes =
      cuenta.limiteConsultas === null ? null : Math.max(0, cuenta.limiteConsultas - cuenta.consultasUsadas);

    return {
      ...cuenta,
      consultasRestantes,
    };
  }

  async findExpiringSoon(daysBefore: number): Promise<Cuenta[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysBefore);

    return await this.prisma.cuenta.findMany({
      where: {
        renovacionAt: {
          lte: expirationDate,
        },
        activa: true,
      },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
          },
        },
      },
    });
  }

  async findByPlan(plan: string): Promise<Cuenta[]> {
    return await this.prisma.cuenta.findMany({
      where: { plan },
      include: {
        usuario: true,
      },
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
