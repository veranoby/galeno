import prisma from '../../config/database.js';
import { Paciente } from '@prisma/client';

export const pacienteService = {
  async findById(id: string): Promise<Paciente | null> {
    return prisma.paciente.findUnique({
      where: { id }, 
      include: {
        cuenta: {
          select: {
            nombre: true, 
            email: true
          }
        }
      }
    });
  },

  async findAll(cuentaId: string): Promise<Paciente[]> {
    return prisma.paciente.findMany({
      where: { cuentaId }, 
      orderBy: { nombre: 'asc' }
    });
  },

  async search(cuentaId: string,  query: string): Promise<Paciente[]> {
    return prisma.paciente.findMany({
      where: {
        cuentaId, 
        OR: [
          { nombre: { contains: query,  mode: 'insensitive' } }, 
          { cedula: { contains: query } }
        ]
      }, 
      take: 20
    });
  }
};

export default pacienteService;
