// apps/api/src/repositories/prisma/PrismaPagoRepository.ts
/**
 * Implementación del Repository de Pagos con Prisma
 */

import { IPagoRepository, CreatePagoDTO, UpdatePagoDTO, PagoFindOptions } from '../interfaces/IPagoRepository';
import { Pago, PrismaClient } from '@prisma/client';

export class PrismaPagoRepository implements IPagoRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePagoDTO): Promise<Pago> {
    return await this.prisma.pago.create({ data });
  }

  async findMany(options: PagoFindOptions = {}): Promise<Pago[]> {
    const { where, orderBy, limit, offset, include } = options;
    return await this.prisma.pago.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
    });
  }

  async findById(id: string, options: PagoFindOptions = {}): Promise<Pago | null> {
    const { include } = options;
    return await this.prisma.pago.findUnique({
      where: { id },
      include,
    });
  }

  async findByPaciente(pacienteId: string, options: Omit<PagoFindOptions, 'where'> = {}): Promise<Pago[]> {
    return this.findMany({
      ...options,
      where: { pacienteId },
    });
  }

  async findByCuenta(cuentaId: string, options: Omit<PagoFindOptions, 'where'> = {}): Promise<Pago[]> {
    return this.findMany({
      ...options,
      where: { cuentaId },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, options: Omit<PagoFindOptions, 'where'> = {}): Promise<Pago[]> {
    return this.findMany({
      ...options,
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  async update(id: string, data: UpdatePagoDTO): Promise<Pago> {
    return await this.prisma.pago.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, estado: string, metadata?: Record<string, unknown>): Promise<Pago> {
    return await this.prisma.pago.update({
      where: { id },
      data: {
        estado,
        ...(metadata && { metadata }),
      },
    });
  }

  async count(options: PagoFindOptions = {}): Promise<number> {
    const { where } = options;
    return await this.prisma.pago.count({ where });
  }

  async sumByStatus(cuentaId?: string, startDate?: Date, endDate?: Date): Promise<{
    pendiente: number;
    completado: number;
    fallido: number;
    reembolsado: number;
  }> {
    const where: any = {};
    if (cuentaId) where.cuentaId = cuentaId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [pendiente, completado, fallido, reembolsado] = await Promise.all([
      this.prisma.pago.aggregate({
        where: { ...where, estado: 'PENDIENTE' },
        _sum: { monto: true },
      }),
      this.prisma.pago.aggregate({
        where: { ...where, estado: 'COMPLETADO' },
        _sum: { monto: true },
      }),
      this.prisma.pago.aggregate({
        where: { ...where, estado: 'FALLIDO' },
        _sum: { monto: true },
      }),
      this.prisma.pago.aggregate({
        where: { ...where, estado: 'REEMBOLSADO' },
        _sum: { monto: true },
      }),
    ]);

    return {
      pendiente: pendiente._sum.monto?.toNumber() || 0,
      completado: completado._sum.monto?.toNumber() || 0,
      fallido: fallido._sum.monto?.toNumber() || 0,
      reembolsado: reembolsado._sum.monto?.toNumber() || 0,
    };
  }

  async findPendingRetry(): Promise<Pago[]> {
    // Buscar pagos pendientes que pueden reintentarse
    const retryWindow = new Date();
    retryWindow.setHours(retryWindow.getHours() - 24);

    return await this.prisma.pago.findMany({
      where: {
        estado: 'PENDIENTE',
        reintentos: { lt: 3 },
        updatedAt: { lt: retryWindow },
      },
    });
  }

  async findByExternalId(externalId: string): Promise<Pago | null> {
    return await this.prisma.pago.findFirst({
      where: { externalId },
    });
  }

  async getCuentaMetrics(cuentaId: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    recaudado: number;
    pendiente: number;
    tasaCompletado: number;
  }> {
    const where: any = { cuentaId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, sumData] = await Promise.all([
      this.prisma.pago.count({ where }),
      this.prisma.pago.aggregate({
        where,
        _count: true,
        _sum: { monto: true },
      }),
    ]);

    const estadosCount = await this.prisma.pago.groupBy({
      by: ['estado'],
      where,
      _count: true,
    });

    const completados = estadosCount.find(e => e.estado === 'COMPLETADO')?._count || 0;
    const recaudado = sumData._sum.monto?.toNumber() || 0;
    const pendiente = sumData._sum.monto?.toNumber() || 0;

    return {
      total,
      recaudado,
      pendiente,
      tasaCompletado: total > 0 ? (completados / total) * 100 : 0,
    };
  }
}
