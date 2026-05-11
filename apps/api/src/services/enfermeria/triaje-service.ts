import { PrismaClient } from '@prisma/client';
import { sseManager } from '../sse/sse-manager.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Service for handling triage operations
 */
class TriageService {
  /**
   * Update triage data and notify the corresponding doctor
   */
  async updateTriage(
    consultaId: string,
    triajeData: any,
    updatedById: string
  ): Promise<any> {
    try {
      // Update the consultation with triage data
      const updatedConsulta = await prisma.consulta.update({
        where: { id: consultaId },
        data: {
          triajeData,
          estado: 'pendiente',  // Change state to pending after triage completion
          updatedAt: new Date()
        },
        include: {
          paciente: true,
          doctor: true
        }
      });

      // Notify the doctor that triage is completed
      await this.notifyDoctorTriageCompleted(updatedConsulta.doctorId,  updatedConsulta);

      logger.info({
        consultaId, 
        doctorId: updatedConsulta.doctorId, 
        pacienteId: updatedConsulta.pacienteId
      },  'Triage updated and doctor notified');

      return updatedConsulta;
    } catch (error) {
      logger.error({ error,  consultaId,  updatedById },  'Error updating triage');
      throw error;
    }
  }

  /**
   * Notify doctor that triage is completed
   */
  private async notifyDoctorTriageCompleted(doctorId: string,  consulta: any) {
    try {
      const triageNotification = {
        type: 'TRIAGE_COMPLETED',
        data: {
          consultaId: consulta.id,
          pacienteId: consulta.pacienteId,
          pacienteNombre: `${consulta.paciente.nombre} ${consulta.paciente.apellido}`,
          doctorId: consulta.doctorId,
          timestamp: new Date().toISOString(),
          consulta: {
            id: consulta.id,
            estado: consulta.estado,
            fechaConsulta: consulta.fechaConsulta,
            motivoConsulta: consulta.motivoConsulta
          }
        },
        timestamp: Date.now()
      };

      // Send notification to the doctor via SSE
      await sseManager.sendToUser(doctorId,  triageNotification);

      logger.info({
        doctorId, 
        consultaId: consulta.id, 
        pacienteId: consulta.pacienteId
      },  'Triage completion notification sent to doctor');
    } catch (error) {
      logger.error({ 
        error,  
        doctorId,  
        consultaId: consulta.id 
      },  'Error sending triage completion notification');
    }
  }

  /**
   * Get triage data for a specific consultation
   */
  async getTriageData(consultaId: string): Promise<any> {
    try {
      const consulta = await prisma.consulta.findUnique({
        where: { id: consultaId },
        select: { triajeData: true,  estado: true }
      });

      return consulta?.triajeData || null;
    } catch (error) {
      logger.error({ error,  consultaId },  'Error getting triage data');
      throw error;
    }
  }

  /**
   * Bulk update triage status for multiple consultations
   */
  async bulkUpdateTriageStatus(
    consultaIds: string[],  
    newStatus: 'triaje' | 'pendiente', 
    updatedById: string
  ): Promise<number> {
    try {
      const result = await prisma.consulta.updateMany({
        where: {
          id: { in: consultaIds }, 
          estado: { in: ['borrador',  'triaje'] } // Only allow updating from draft or triage states
        }, 
        data: {
          estado: newStatus, 
          updatedAt: new Date()
        }
      });

      // Notify doctors for each consultation that changed to 'pendiente'
      if (newStatus === 'pendiente') {
        const updatedConsultas = await prisma.consulta.findMany({
          where: { id: { in: consultaIds } }, 
          include: { doctor: true }
        });

        for (const consulta of updatedConsultas) {
          await this.notifyDoctorTriageCompleted(consulta.doctorId,  consulta);
        }
      }

      logger.info({
        consultaIds, 
        newStatus, 
        updatedById, 
        count: result.count
      },  'Bulk triage status update completed');

      return result.count;
    } catch (error) {
      logger.error({ 
        error,  
        consultaIds,  
        newStatus,  
        updatedById 
      },  'Error in bulk triage status update');
      throw error;
    }
  }
}

export const triajeService = new TriageService();