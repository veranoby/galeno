// apps/api/src/repositories/prisma/PrismaConsultaRepository.ts
/**
 * Implementación del Repository de Consultas con Prisma
 */

import { IConsultaRepository, CreateConsultaDTO, UpdateConsultaDTO, ConsultaFindOptions } from '../interfaces/IConsultaRepository';
import { Consulta, PrismaClient } from '@prisma/client';

export class PrismaConsultaRepository implements IConsultaRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateConsultaDTO): Promise<Consulta> {
    return await this.prisma.consulta.create({ data });
  }

  async findMany(options: ConsultaFindOptions = {}): Promise<Consulta[]> {
    const { where, orderBy, limit, offset, include } = options;
    return await this.prisma.consulta.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
    });
  }

  async findByPaciente(pacienteId: string, options: Omit<ConsultaFindOptions, 'where'> = {}): Promise<Consulta[]> {
    return this.findMany({
      ...options,
      where: { pacienteId },
    });
  }

  async findByDoctor(doctorId: string, options: Omit<ConsultaFindOptions, 'where'> = {}): Promise<Consulta[]> {
    return this.findMany({
      ...options,
      where: { doctorId },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, options: Omit<ConsultaFindOptions, 'where'> = {}): Promise<Consulta[]> {
    return this.findMany({
      ...options,
      where: {
        fechaHora: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  async findById(id: string, options: ConsultaFindOptions = {}): Promise<Consulta | null> {
    const { include } = options;
    return await this.prisma.consulta.findUnique({
      where: { id },
      include,
    });
  }

  async update(id: string, data: UpdateConsultaDTO): Promise<Consulta> {
    return await this.prisma.consulta.update({
      where: { id },
      data,
    });
  }

  async updateMany(where: any, data: UpdateConsultaDTO): Promise<{ count: number }> {
    return await this.prisma.consulta.updateMany({ where, data });
  }

  async delete(id: string): Promise<Consulta> {
    return await this.prisma.consulta.delete({
      where: { id },
    });
  }

  async count(options: ConsultaFindOptions = {}): Promise<number> {
    const { where } = options;
    return await this.prisma.consulta.count({ where });
  }

  async getDoctorStats(doctorId: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    completadas: number;
    canceladas: number;
    pendientes: number;
  }> {
    const where: any = { doctorId };
    if (startDate || endDate) {
      where.fechaHora = {};
      if (startDate) where.fechaHora.gte = startDate;
      if (endDate) where.fechaHora.lte = endDate;
    }

    const [total, completadas, canceladas, pendientes] = await Promise.all([
      this.prisma.consulta.count({ where }),
      this.prisma.consulta.count({ where: { ...where, estado: 'COMPLETADA' } }),
      this.prisma.consulta.count({ where: { ...where, estado: 'CANCELADA' } }),
      this.prisma.consulta.count({ where: { ...where, estado: 'PROGRAMADA' } }),
    ]);

    return { total, completadas, canceladas, pendientes };
  }

  async findPendingSignature(doctorId: string): Promise<Consulta[]> {
    return await this.prisma.consulta.findMany({
      where: {
        doctorId,
        estado: 'COMPLETADA',
        firmada: false,
      },
      include: {
        paciente: true,
      },
    });
  }
}
