import { PrismaClient, AuditLog, AuditAction, ResourceType, EstadoConsulta } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import AuditService from '../audit/audit.service.js';
import {
  canTransition,
  validateTransition,
  getNextStates,
  isTerminalState,
  getAllStatesOrdered,
  getStateInfo
} from '../stateMachine.js';

const prisma = new PrismaClient();

/**
 * State transition audit log metadata
 */
export interface StateTransitionAuditData {
  consultaId: string;
  pacienteId: string;
  previousState: EstadoConsulta;
  newState: EstadoConsulta;
  changedBy: string;
  changedByRole: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    reason?: string;
    teleconsulta?: boolean;
    triageComplete?: boolean;
    interconsultaId?: string;
    [key: string]: any;
  };
}

/**
 * Orphan state detection result
 */
export interface OrphanStateResult {
  consultaId: string;
  currentState: EstadoConsulta;
  issue: 'ORPHAN_STATE' | 'INVALID_TRANSITION' | 'MISSING_AUDIT_LOG' | 'TERMINAL_STATE_VIOLATION';
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
}

/**
 * State machine audit report
 */
export interface StateMachineAuditReport {
  totalConsultas: number;
  auditedTransitions: number;
  orphanStates: OrphanStateResult[];
  missingAuditLogs: string[];
  transitionSummary: Record<string, number>;
  complianceScore: number;
  timestamp: Date;
}

/**
 * Service for auditing state machine transitions
 * Ensures all state transitions are logged and valid
 * Detects orphan states and compliance gaps
 */
class ConsultationAuditService {
  /**
   * Log a state transition with comprehensive audit data
   *
   * @param data - State transition audit data
   * @returns Audit log entry or void if failed
   */
  async logStateTransition(data: StateTransitionAuditData): Promise<AuditLog | void> {
    try {
      // Validate transition before logging
      validateTransition(data.previousState, data.newState);

      const auditData = {
        userId: data.changedBy,
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: ResourceType.CONSULTA,
        resourceId: data.consultaId,
        rolUsuario: data.changedByRole,
        ip: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {
          ...data.metadata,
          transition: {
            from: data.previousState,
            to: data.newState,
            timestamp: new Date().toISOString()
          },
          pacienteId: data.pacienteId,
          teleconsulta: data.metadata?.teleconsulta || false
        }
      };

      const auditLog = await AuditService.log(auditData);

      logger.info({
        consultaId: data.consultaId,
        previousState: data.previousState,
        newState: data.newState,
        changedBy: data.changedBy,
        auditLogId: (auditLog as any)?.id
      }, 'State transition audited');

      return auditLog;
    } catch (error) {
      logger.error({
        error,
        consultaId: data.consultaId,
        previousState: data.previousState,
        newState: data.newState
      }, 'Failed to log state transition');
      throw error;
    }
  }

  /**
   * Detect orphan states in consultations
   * An orphan state is when a consultation is in an invalid or unreachable state
   *
   * @param consultaId - Optional: specific consulta to check, or all if not provided
   * @returns Array of orphan state results
   */
  async detectOrphanStates(consultaId?: string): Promise<OrphanStateResult[]> {
    const orphanResults: OrphanStateResult[] = [];

    try {
      // Fetch consultations
      const consultas = await prisma.consulta.findMany({
        where: consultaId ? { id: consultaId } : undefined,
        select: {
          id: true,
          estado: true,
          pacienteId: true,
          createdAt: true,
          updatedAt: true,
          parentId: true
        }
      });

      for (const consulta of consultas) {
        const estado = consulta.estado as EstadoConsulta;

        // Check 1: Is the state a valid EstadoConsulta enum value?
        const validStates = getAllStatesOrdered();
        if (!validStates.includes(estado)) {
          orphanResults.push({
            consultaId: consulta.id,
            currentState: estado,
            issue: 'ORPHAN_STATE',
            description: `Consulta is in invalid state '${estado}' which is not in the state machine definition`,
            severity: 'HIGH',
            recommendedAction: `Manually review and correct state. Valid states are: ${validStates.join(', ')}`
          });
          continue;
        }

        // Check 2: Is it a terminal state violation?
        if (isTerminalState(estado)) {
          // Check if there are any child consultations or related records that suggest it should not be terminal
          const hasChildren = consulta.parentId === null; // Simplified check
          if (hasChildren) {
            orphanResults.push({
              consultaId: consulta.id,
              currentState: estado,
              issue: 'TERMINAL_STATE_VIOLATION',
              description: `Consulta in terminal state '${estado}' but may have related active records`,
              severity: 'MEDIUM',
              recommendedAction: 'Review related records (interconsultas, documentos) for consistency'
            });
          }
        }

        // Check 3: Validate transition path exists from initial state
        const hasValidPath = this.hasValidTransitionPath('borrador', estado);
        if (!hasValidPath) {
          orphanResults.push({
            consultaId: consulta.id,
            currentState: estado,
            issue: 'INVALID_TRANSITION',
            description: `No valid transition path exists from 'borrador' to '${estado}'`,
            severity: 'HIGH',
            recommendedAction: 'Review state transition history and correct if needed'
          });
        }
      }

      return orphanResults;
    } catch (error) {
      logger.error({ error, consultaId }, 'Error detecting orphan states');
      throw error;
    }
  }

  /**
   * Check if a valid transition path exists between two states
   * Uses BFS to find if there's a path in the state machine graph
   *
   * @param from - Starting state
   * @param to - Target state
   * @returns true if a valid path exists
   */
  private hasValidTransitionPath(from: EstadoConsulta, to: EstadoConsulta): boolean {
    if (from === to) return true;

    const visited = new Set<EstadoConsulta>();
    const queue: EstadoConsulta[] = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);

      const nextStates = getNextStates(current);
      for (const nextState of nextStates) {
        if (nextState === to) return true;
        if (!visited.has(nextState)) {
          queue.push(nextState);
        }
      }
    }

    return false;
  }

  /**
   * Detect missing audit logs for state transitions
   * Compares consultation update history with audit log entries
   *
   * @param limit - Maximum number of consultas to check (default: 100)
   * @returns Array of consulta IDs with missing audit logs
   */
  async detectMissingAuditLogs(limit: number = 100): Promise<string[]> {
    const missingLogs: string[] = [];

    try {
      // Fetch recent consultas that have been updated (potential state transitions)
      const consultas = await prisma.consulta.findMany({
        take: limit,
        where: {
          estado: {
            not: 'borrador' // Skip initial state
          }
        },
        select: {
          id: true,
          updatedAt: true
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      for (const consulta of consultas) {
        // Check if there's an audit log for state transitions
        const auditLogs = await prisma.auditLog.findMany({
          where: {
            resourceId: consulta.id,
            resourceType: ResourceType.CONSULTA,
            action: AuditAction.RESOURCE_UPDATE,
            metadata: {
              path: ['transition'],
              not: null
            }
          },
          take: 1
        });

        if (auditLogs.length === 0) {
          missingLogs.push(consulta.id);
        }
      }

      if (missingLogs.length > 0) {
        logger.warn({
          count: missingLogs.length,
          sampleIds: missingLogs.slice(0, 5)
        }, 'Detected consultas with missing state transition audit logs');
      }

      return missingLogs;
    } catch (error) {
      logger.error({ error }, 'Error detecting missing audit logs');
      throw error;
    }
  }

  /**
   * Generate comprehensive state machine audit report
   *
   * @param options - Audit options
   * @returns State machine audit report
   */
  async generateAuditReport(options?: {
    sampleSize?: number;
    includeTransitionSummary?: boolean;
  }): Promise<StateMachineAuditReport> {
    const sampleSize = options?.sampleSize || 1000;

    try {
      // Get total consultas count
      const totalConsultas = await prisma.consulta.count();

      // Detect orphan states
      const orphanStates = await this.detectOrphanStates();

      // Detect missing audit logs
      const missingAuditLogs = await this.detectMissingAuditLogs(sampleSize);

      // Get transition summary if requested
      const transitionSummary: Record<string, number> = {};
      if (options?.includeTransitionSummary) {
        const recentTransitions = await prisma.auditLog.findMany({
          where: {
            resourceType: ResourceType.CONSULTA,
            action: AuditAction.RESOURCE_UPDATE,
            metadata: {
              path: ['transition'],
              not: null
            }
          },
          take: sampleSize,
          orderBy: { timestamp: 'desc' }
        });

        for (const log of recentTransitions) {
          const metadata = log.metadata as any;
          if (metadata?.transition) {
            const key = `${metadata.transition.from}→${metadata.transition.to}`;
            transitionSummary[key] = (transitionSummary[key] || 0) + 1;
          }
        }
      }

      // Calculate compliance score
      const auditedTransitions = await prisma.auditLog.count({
        where: {
          resourceType: ResourceType.CONSULTA,
          action: AuditAction.RESOURCE_UPDATE,
          metadata: {
            path: ['transition'],
            not: null
          }
        }
      });

      const complianceScore = this.calculateComplianceScore({
        totalConsultas,
        auditedTransitions,
        orphanStatesCount: orphanStates.length,
        missingAuditLogsCount: missingAuditLogs.length
      });

      return {
        totalConsultas,
        auditedTransitions,
        orphanStates,
        missingAuditLogs,
        transitionSummary,
        complianceScore,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error({ error }, 'Error generating audit report');
      throw error;
    }
  }

  /**
   * Calculate compliance score based on audit metrics
   * Score ranges from 0 to 100
   *
   * @param metrics - Audit metrics
   * @returns Compliance score (0-100)
   */
  private calculateComplianceScore(metrics: {
    totalConsultas: number;
    auditedTransitions: number;
    orphanStatesCount: number;
    missingAuditLogsCount: number;
  }): number {
    const { totalConsultas, auditedTransitions, orphanStatesCount, missingAuditLogsCount } = metrics;

    // Base score starts at 100
    let score = 100;

    // Deduct for orphan states (HIGH severity: -10 points each)
    score -= orphanStatesCount * 10;

    // Deduct for missing audit logs (proportional penalty)
    if (totalConsultas > 0) {
      const missingRatio = missingAuditLogsCount / totalConsultas;
      score -= missingRatio * 50; // Max -50 for 100% missing
    }

    // Bonus for high audit coverage (max +10)
    if (auditedTransitions > 0 && totalConsultas > 0) {
      const auditRatio = Math.min(auditedTransitions / totalConsultas, 1);
      score += auditRatio * 10;
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get state transition history for a specific consultation
   *
   * @param consultaId - Consulta ID
   * @returns Array of state transitions
   */
  async getTransitionHistory(consultaId: string): Promise<Array<{
    from: EstadoConsulta;
    to: EstadoConsulta;
    timestamp: Date;
    changedBy: string;
    changedByRole: string;
  }>> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          resourceId: consultaId,
          resourceType: ResourceType.CONSULTA,
          action: AuditAction.RESOURCE_UPDATE,
          metadata: {
            path: ['transition'],
            not: null
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      return auditLogs
        .map(log => {
          const metadata = log.metadata as any;
          if (!metadata?.transition) return null;

          return {
            from: metadata.transition.from as EstadoConsulta,
            to: metadata.transition.to as EstadoConsulta,
            timestamp: log.timestamp,
            changedBy: log.userId,
            changedByRole: log.rolUsuario
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);
    } catch (error) {
      logger.error({ error, consultaId }, 'Error getting transition history');
      throw error;
    }
  }

  /**
   * Validate teleconsulta-specific state transitions
   * Teleconsultas may have specific workflow requirements
   *
   * @param consultaId - Consulta ID
   * @param isTeleconsulta - Whether this is a teleconsulta
   * @returns Validation result
   */
  async validateTeleconsultaTransitions(
    consultaId: string,
    isTeleconsulta: boolean
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!isTeleconsulta) {
      return { valid: true, issues: [] };
    }

    try {
      const consulta = await prisma.consulta.findUnique({
        where: { id: consultaId },
        select: {
          estado: true,
          pacienteId: true,
          doctorId: true
        }
      });

      if (!consulta) {
        return { valid: false, issues: ['Consulta not found'] };
      }

      // Teleconsulta specific validations
      // Note: We can't directly access cita from consulta in this query
      // This validation should be done at the route level where cita is available
      // For now, we validate the state machine path

      // Check that teleconsulta follows proper state path
      const currentState = consulta.estado as EstadoConsulta;
      const validPath = this.hasValidTransitionPath('borrador', currentState);

      if (!validPath) {
        issues.push(`Invalid state path for teleconsulta: ${currentState}`);
      }

      // Check for audit log on last transition
      const recentTransitions = await this.getTransitionHistory(consultaId);
      if (recentTransitions.length === 0 && currentState !== 'borrador') {
        issues.push('No audit trail for teleconsulta state transitions');
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      logger.error({ error, consultaId }, 'Error validating teleconsulta transitions');
      return { valid: false, issues: ['Validation error occurred'] };
    }
  }
}

export const consultationAuditService = new ConsultationAuditService();
export default consultationAuditService;
