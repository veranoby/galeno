// apps/api/src/repositories/prisma/PrismaPacienteRepository.ts
/**
 * Implementación del Repository de Pacientes con Prisma
 */

import { IPacienteRepository, CreatePacienteDTO, UpdatePacienteDTO, PacienteFindOptions } from '../interfaces/IPacienteRepository';
import { Paciente, Cuenta, PrismaClient } from '@prisma/client';

export class PrismaPacienteRepository implements IPacienteRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePacienteDTO): Promise<Paciente> {
    return await this.prisma.paciente.create({ data });
  }

  async findMany(options: PacienteFindOptions = {}): Promise<Paciente[]> {
    const { where, orderBy, limit, offset, include } = options;
    return await this.prisma.paciente.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
    });
  }

  async findById(id: string, options: PacienteFindOptions = {}): Promise<Paciente | null> {
    const { include } = options;
    return await this.prisma.paciente.findUnique({
      where: { id },
      include,
    });
  }

  async findByCedula(cedula: string): Promise<Paciente | null> {
    return await this.prisma.paciente.findUnique({
      where: { cedula },
    });
  }

  async search(query: string, options: Omit<PacienteFindOptions, 'where'> = {}): Promise<Paciente[]> {
    return this.findMany({
      ...options,
      where: {
        OR: [
          { nombre: { contains: query, mode: 'insensitive' } },
          { cedula: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  }

  async findByDoctor(doctorId: string, options: Omit<PacienteFindOptions, 'where'> = {}): Promise<Paciente[]> {
    // Buscar pacientes que tienen conexión con el doctor
    return this.findMany({
      ...options,
      where: {
        conexiones: {
          some: {
            doctorId,
          },
        },
      },
      include: {
        conexiones: {
          where: { doctorId },
          include: {
            doctor: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdatePacienteDTO): Promise<Paciente> {
    return await this.prisma.paciente.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Paciente> {
    return await this.prisma.paciente.delete({
      where: { id },
    });
  }

  async count(options: PacienteFindOptions = {}): Promise<number> {
    const { where } = options;
    return await this.prisma.paciente.count({ where });
  }

  async existsByCedula(cedula: string): Promise<boolean> {
    const count = await this.prisma.paciente.count({
      where: { cedula },
    });
    return count > 0;
  }

  async findWithActiveHealthWallet(options: Omit<PacienteFindOptions, 'where'> = {}): Promise<Paciente[]> {
    return this.findMany({
      ...options,
      where: {
        healthWallet: {
          activo: true,
        },
      },
      include: {
        healthWallet: true,
      },
    });
  }

  async findActiveConnections(pacienteId: string): Promise<Cuenta[]> {
    const conexiones = await this.prisma.conexionPaciente.findMany({
      where: {
        pacienteId,
        estado: 'activa',
        OR: [
          { fechaExpiracion: { gt: new Date() } },
          { fechaExpiracion: null },
        ],
      },
      include: {
        doctor: true,
        paciente: true,
      },
    });

    // Retornar los doctores conectados a este paciente
    return conexiones
      .map(c => c.doctor)
      .filter((d): d is Cuenta => d != null);
  }
}
