// apps/api/src/services/doctor/dashboard-service.ts
import prisma from '../../config/database.js';
import { Consulta, Cita, Cuenta } from '@prisma/client';

export interface DashboardMetrics {
  consultasHoy: number;
  consultasSemana: number;
  consultasPendientes: number;
  consultasMes: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  consultasPendientes: Array<{
    id: string;
    paciente: {
      id: string;
      nombre: string;
      cedula: string;
    };
    motivoConsulta?: string;
    createdAt: Date;
    estado: string;
  }>;
  citasProximas: Array<{
    id: string;
    paciente: {
      id: string;
      nombre: string;
      cedula: string;
    };
    fechaHora: Date;
    tipo: 'presencial' | 'teleconsulta';
  }>;
}

export async function getDoctorDashboardData(doctorId: string): Promise<DashboardData> {
  // Calculate date ranges
  const today = new Date();
  const startOfDay = new Date(today.setHours(0,  0,  0,  0));
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay()); // Assuming week starts on Sunday
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Get metrics
  const [
    consultasHoy,
    consultasSemana,
    consultasPendientesCount,
    consultasMes
  ] = await Promise.all([
    // Consultas hoy
    prisma.consulta.count({
      where: {
        doctorId, 
        createdAt: {
          gte: startOfDay
        }
      }
    }),
    
    // Consultas esta semana
    prisma.consulta.count({
      where: {
        doctorId, 
        createdAt: {
          gte: startOfWeek
        }
      }
    }),
    
    // Consultas pendientes
    prisma.consulta.count({
      where: {
        doctorId, 
        estado: {
          in: ['pendiente',  'en_atencion']
        }
      }
    }),
    
    // Consultas este mes
    prisma.consulta.count({
      where: {
        doctorId, 
        createdAt: {
          gte: startOfMonth
        }
      }
    })
  ]);
  
  // Get pending consultations (limited to 5)
  const consultasPendientes = await prisma.consulta.findMany({
    where: {
      doctorId, 
      estado: {
        in: ['pendiente',  'en_atencion']
      }
    }, 
    include: {
      paciente: {
        select: {
          id: true, 
          nombre: true, 
          cedula: true
        }
      }
    }, 
    orderBy: {
      createdAt: 'asc'
    }, 
    take: 5
  });
  
  // Get upcoming appointments (next 5)
  const citasProximas = await prisma.cita.findMany({
    where: {
      doctorId, 
      fechaHora: {
        gte: new Date()
      },
      estado: {
        not: 'cancelada'
      }
    },
    include: {
      paciente: {
        select: {
          id: true,
          nombre: true,
          cedula: true
        }
      }
    },
    orderBy: {
      fechaHora: 'asc'
    },
    take: 5
  });
  
  return {
    metrics: {
      consultasHoy,
      consultasSemana,
      consultasPendientes: consultasPendientesCount,
      consultasMes
    },
    consultasPendientes: consultasPendientes.map(consulta => ({
      id: consulta.id, 
      paciente: {
        id: consulta.paciente.id, 
        nombre: consulta.paciente.nombre, 
        cedula: consulta.paciente.cedula
      }, 
      motivoConsulta: consulta.motivoConsulta || undefined, 
      createdAt: consulta.createdAt, 
      estado: consulta.estado
    })),
    citasProximas: citasProximas.map(cita => ({
      id: cita.id, 
      paciente: {
        id: cita.paciente.id, 
        nombre: cita.paciente.nombre, 
        cedula: cita.paciente.cedula
      }, 
      fechaHora: cita.fechaHora, 
      tipo: cita.tipo as 'presencial' | 'teleconsulta'
    }))
  };
}