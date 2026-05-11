import { PrismaClient } from '@prisma/client';
import { sseManager } from '../sse/sse-manager.js';
import { logger } from '../../utils/logger.js';
import { validateTransition, canTransition } from '../stateMachine.js';
import consultationAuditService from '../consultation/consultation-audit.service.js';

const prisma = new PrismaClient();

/**
 * Triage data structure for vital signs capture
 */
export interface TriageData {
  // Vital signs
  bloodPressure?: string; // e.g., "120/80"
  heartRate?: number; // BPM
  temperature?: number; // Celsius
  respiratoryRate?: number; // Breaths per minute
  oxygenSaturation?: number; // Percentage
  weight?: number; // kg
  height?: number; // cm
  
  // Additional clinical data
  chiefComplaint?: string;
  allergyStatus?: string;
  currentMedications?: string;
  painLevel?: number; // 1-10 scale
  notes?: string;
  
  // Triage completion flag
  isComplete?: boolean;
}

/**
 * Service for handling triage operations with state machine integration
 */
class TriageService {
  /**
   * Capture triage data and transition consultation state
   * 
   * State transitions:
   * - borrador → triaje: Initial triage capture
   * - triaje → pendiente: Complete triage, ready for doctor
   * 
   * @param consultaId - Consultation UUID
   * @param triageData - Vital signs and clinical data
   * @param updatedById - User ID performing the update (nurse)
   * @returns Updated consultation with triage data
   */
  async captureTriage(
    consultaId: string,
    triageData: TriageData,
    updatedById: string
  ): Promise<any> {
    try {
      // Get current consultation state
      const existingConsulta = await prisma.consulta.findUnique({
        where: { id: consultaId },
        select: { estado: true, doctorId: true }
      });

      if (!existingConsulta) {
        throw new Error(`Consulta not found: ${consultaId}`);
      }

      // Determine target state based on completion flag
      const targetState = triageData.isComplete ? 'pendiente' : 'triaje';

      // Validate state transition using state machine
      this.validateTriageTransition(existingConsulta.estado, targetState);

      // Update consultation with triage data and new state
      const updatedConsulta = await prisma.consulta.update({
        where: { id: consultaId },
        data: {
          triajeData: triageData as any, // Prisma Json type
          estado: targetState,
          updatedAt: new Date()
        },
        include: {
          paciente: true,
          doctor: true
        }
      });

      // Notify doctor if triage is complete (transitioning to pendiente)
      if (targetState === 'pendiente') {
        await this.notifyDoctorTriageCompleted(updatedConsulta.doctorId, updatedConsulta);
      }

      // Log state transition to audit trail
      try {
        await consultationAuditService.logStateTransition({
          consultaId: updatedConsulta.id,
          pacienteId: updatedConsulta.pacienteId,
          previousState: existingConsulta.estado,
          newState: targetState,
          changedBy: updatedById,
          changedByRole: 'ENFERMERA', // Triage is typically performed by nurses
          metadata: {
            triageComplete: triageData.isComplete || false,
            teleconsulta: false
          }
        });
      } catch (auditError) {
        // Don't fail the operation if audit logging fails
        logger.error({ auditError, consultaId }, 'Failed to log triage state transition audit');
      }

      logger.info({
        consultaId,
        previousState: existingConsulta.estado,
        newState: targetState,
        doctorId: updatedConsulta.doctorId,
        updatedById
      }, 'Triage captured and state transitioned');

      return updatedConsulta;
    } catch (error) {
      logger.error({ error, consultaId, updatedById }, 'Error capturing triage');
      throw error;
    }
  }

  /**
   * Validate triage state transition using state machine
   * 
   * @param from - Current state
   * @param to - Target state
   * @throws Error if transition is invalid
   */
  validateTriageTransition(from: string, to: string): void {
    try {
      validateTransition(from as any, to as any);
    } catch (error) {
      const validTransitions = canTransition(from as any, to as any);
      if (!validTransitions) {
        throw new Error(
          `Invalid triage state transition: ${from} -> ${to}. ` +
          `Valid transitions from ${from} must follow the state machine rules.`
        );
      }
    }
  }

  /**
   * Notify doctor that triage is completed and consultation is ready
   * 
   * @param doctorId - Doctor's user ID
   * @param consulta - Consultation with patient and triage data
   */
  private async notifyDoctorTriageCompleted(doctorId: string, consulta: any) {
    try {
      const triageNotification = {
        type: 'TRIAGE_COMPLETED',
        data: {
          consultaId: consulta.id,
          pacienteId: consulta.pacienteId,
          pacienteNombre: `${consulta.paciente.nombre} ${consulta.paciente.apellido}`,
          doctorId: consulta.doctorId,
          timestamp: new Date().toISOString(),
          triageData: consulta.triajeData,
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
      await sseManager.sendToUser(doctorId, triageNotification);

      logger.info({
        doctorId,
        consultaId: consulta.id,
        pacienteId: consulta.pacienteId
      }, 'Triage completion notification sent to doctor');
    } catch (error) {
      logger.error({
        error,
        doctorId,
        consultaId: consulta.id
      }, 'Error sending triage completion notification');
      // Don't rethrow - notification failure shouldn't block the operation
    }
  }

  /**
   * Get triage data for a specific consultation
   * 
   * @param consultaId - Consultation UUID
   * @returns Triage data and current state
   */
  async getTriageData(consultaId: string): Promise<{ triajeData: TriageData | null; estado: string } | null> {
    try {
      const consulta = await prisma.consulta.findUnique({
        where: { id: consultaId },
        select: { triajeData: true, estado: true }
      });

      if (!consulta) {
        return null;
      }

      return {
        triajeData: consulta.triajeData as TriageData | null,
        estado: consulta.estado
      };
    } catch (error) {
      logger.error({ error, consultaId }, 'Error getting triage data');
      throw error;
    }
  }

  /**
   * Bulk update triage status for multiple consultations
   * 
   * Only allows updating from 'borrador' or 'triaje' states
   * Notifies doctors when transitioning to 'pendiente'
   * 
   * @param consultaIds - Array of consultation UUIDs
   * @param newStatus - Target status ('triaje' | 'pendiente')
   * @param updatedById - User ID performing the update
   * @returns Number of consultations updated
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
          estado: { in: ['borrador', 'triaje'] } // Only allow updating from draft or triage states
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
          include: { 
            doctor: true,
            paciente: true
          }
        });

        for (const consulta of updatedConsultas) {
          await this.notifyDoctorTriageCompleted(consulta.doctorId, consulta);
        }
      }

      logger.info({
        consultaIds,
        newStatus,
        updatedById,
        count: result.count
      }, 'Bulk triage status update completed');

      return result.count;
    } catch (error) {
      logger.error({
        error,
        consultaIds,
        newStatus,
        updatedById
      }, 'Error in bulk triage status update');
      throw error;
    }
  }

  /**
   * Get consultations in triage state for a specific doctor
   * 
   * @param doctorId - Doctor's user ID
   * @returns Array of consultations in triage state
   */
  async getTriageQueue(doctorId: string): Promise<any[]> {
    try {
      const consultas = await prisma.consulta.findMany({
        where: {
          doctorId,
          estado: { in: ['triaje', 'pendiente'] }
        },
        include: {
          paciente: {
            select: {
              id: true,
              nombre: true,
              cedula: true,
              fechaNacimiento: true
            }
          }
        },
        orderBy: {
          updatedAt: 'asc' // Oldest first (FIFO)
        }
      });

      return consultas;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting triage queue');
      throw error;
    }
  }
}

export const triageService = new TriageService();
