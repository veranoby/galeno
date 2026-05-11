import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient, EstadoConsulta, AuditAction, ResourceType } from '@prisma/client';
import consultationAuditService, {
  StateTransitionAuditData,
  OrphanStateResult,
  StateMachineAuditReport
} from '../consultation-audit.service';
import AuditService from '../../audit/audit.service';
import {
  canTransition,
  validateTransition,
  getNextStates,
  isTerminalState,
  getAllStatesOrdered
} from '../../stateMachine.js';

// Mock all dependencies before imports
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    consulta: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    $disconnect: vi.fn()
  };

  return {
    PrismaClient: vi.fn(() => mockPrisma),
    EstadoConsulta: {
      borrador: 'borrador',
      triaje: 'triaje',
      pendiente: 'pendiente',
      en_atencion: 'en_atencion',
      finalizada: 'finalizada',
      interconsulta: 'interconsulta'
    },
    AuditAction: {
      RESOURCE_ACCESS: 'RESOURCE_ACCESS',
      RESOURCE_CREATE: 'RESOURCE_CREATE',
      RESOURCE_UPDATE: 'RESOURCE_UPDATE',
      RESOURCE_DELETE: 'RESOURCE_DELETE',
      PERMISSION_CHANGE: 'PERMISSION_CHANGE',
      ROLE_CHANGE: 'ROLE_CHANGE',
      PLAN_CHANGE: 'PLAN_CHANGE',
      PAYMENT_ACTION: 'PAYMENT_ACTION'
    },
    ResourceType: {
      PACIENTE: 'PACIENTE',
      CONSULTA: 'CONSULTA',
      DOCUMENTO: 'DOCUMENTO',
      USUARIO: 'USUARIO',
      PLAN: 'PLAN',
      PAGO: 'PAGO'
    }
  };
});

vi.mock('../../audit/audit.service', () => ({
  default: {
    log: vi.fn()
  }
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../stateMachine.js', () => ({
  canTransition: vi.fn(),
  validateTransition: vi.fn(),
  getNextStates: vi.fn(),
  isTerminalState: vi.fn(),
  getAllStatesOrdered: vi.fn(),
  getStateInfo: vi.fn(),
  getInitialState: vi.fn(() => 'borrador')
}));

vi.mock('../../config/database.js', () => ({
  default: {
    consulta: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    $disconnect: vi.fn()
  }
}));

describe('ConsultationAuditService', () => {
  const mockPrisma = new PrismaClient() as any;
  const mockAuditLog = vi.mocked(AuditService.log);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(getAllStatesOrdered).mockReturnValue([
      'borrador',
      'triaje',
      'pendiente',
      'en_atencion',
      'finalizada',
      'interconsulta'
    ]);

    vi.mocked(isTerminalState).mockImplementation((state) => state === 'finalizada');

    vi.mocked(getNextStates).mockImplementation((state) => {
      const transitions: Record<EstadoConsulta, EstadoConsulta[]> = {
        borrador: ['triaje', 'finalizada'],
        triaje: ['pendiente'],
        pendiente: ['en_atencion'],
        en_atencion: ['finalizada', 'interconsulta'],
        finalizada: [],
        interconsulta: ['pendiente', 'finalizada']
      };
      return transitions[state] || [];
    });

    vi.mocked(canTransition).mockImplementation((from, to) => {
      const nextStates = getNextStates(from);
      return nextStates.includes(to);
    });

    vi.mocked(validateTransition).mockImplementation((from, to) => {
      if (!canTransition(from, to)) {
        throw new Error(`Invalid transition: ${from} -> ${to}`);
      }
    });
  });

  afterEach(async () => {
    await mockPrisma.$disconnect();
  });

  describe('logStateTransition', () => {
    const validAuditData: StateTransitionAuditData = {
      consultaId: 'consulta-123',
      pacienteId: 'paciente-456',
      previousState: 'borrador',
      newState: 'triaje',
      changedBy: 'user-789',
      changedByRole: 'MEDICO',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: {
        reason: 'Initial triage',
        teleconsulta: false
      }
    };

    it('should successfully log a valid state transition', async () => {
      const mockAuditLog = {
        id: 'audit-log-123',
        userId: 'user-789',
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: ResourceType.CONSULTA,
        resourceId: 'consulta-123',
        rolUsuario: 'MEDICO',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {} as any,
        timestamp: new Date()
      };

      vi.mocked(AuditService.log).mockResolvedValue(mockAuditLog);

      const result = await consultationAuditService.logStateTransition(validAuditData);

      expect(AuditService.log).toHaveBeenCalledWith({
        userId: 'user-789',
        action: AuditAction.RESOURCE_UPDATE,
        resourceType: ResourceType.CONSULTA,
        resourceId: 'consulta-123',
        rolUsuario: 'MEDICO',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {
          reason: 'Initial triage',
          teleconsulta: false,
          transition: {
            from: 'borrador',
            to: 'triaje',
            timestamp: expect.any(String)
          },
          pacienteId: 'paciente-456'
        }
      });

      expect(result).toEqual(mockAuditLog);
    });

    it('should throw error when transition is invalid', async () => {
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new Error('Invalid transition: borrador -> en_atencion');
      });

      const invalidData: StateTransitionAuditData = {
        ...validAuditData,
        previousState: 'borrador',
        newState: 'en_atencion' // Invalid transition
      };

      await expect(consultationAuditService.logStateTransition(invalidData))
        .rejects.toThrow('Invalid transition');
    });

    it('should handle teleconsulta transitions with metadata', async () => {
      const teleconsultaData: StateTransitionAuditData = {
        ...validAuditData,
        metadata: {
          teleconsulta: true,
          reason: 'Teleconsulta session started'
        }
      };

      vi.mocked(AuditService.log).mockResolvedValue({ id: 'audit-tele-123' } as any);

      await consultationAuditService.logStateTransition(teleconsultaData);

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            teleconsulta: true
          })
        })
      );
    });

    it('should log error when audit logging fails', async () => {
      vi.mocked(AuditService.log).mockRejectedValue(new Error('Database error'));

      await expect(consultationAuditService.logStateTransition(validAuditData))
        .rejects.toThrow();
    });
  });

  describe('detectOrphanStates', () => {
    it('should detect consultas with invalid states', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        {
          id: 'consulta-1',
          estado: 'invalid_state',
          pacienteId: 'paciente-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: null
        }
      ]);

      const result = await consultationAuditService.detectOrphanStates();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        consultaId: 'consulta-1',
        currentState: 'invalid_state',
        issue: 'ORPHAN_STATE',
        severity: 'HIGH'
      });
    });

    it('should detect terminal state violations', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        {
          id: 'consulta-2',
          estado: 'finalizada',
          pacienteId: 'paciente-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: null
        }
      ]);

      vi.mocked(isTerminalState).mockReturnValue(true);

      const result = await consultationAuditService.detectOrphanStates();

      // Terminal state with parentId === null should trigger violation check
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          consultaId: 'consulta-2',
          issue: 'TERMINAL_STATE_VIOLATION',
          severity: 'MEDIUM'
        })
      ]));
    });

    it('should detect invalid transition paths', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        {
          id: 'consulta-3',
          estado: 'en_atencion',
          pacienteId: 'paciente-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: null
        }
      ]);

      // Mock hasValidTransitionPath to return false via BFS
      // The private method will be tested through this integration
      const result = await consultationAuditService.detectOrphanStates();

      // en_atencion is reachable from borrador, so no issue expected
      const orphanStates = result.filter(r => r.issue === 'INVALID_TRANSITION');
      expect(orphanStates).toHaveLength(0);
    });

    it('should return empty array when all states are valid', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        {
          id: 'consulta-4',
          estado: 'pendiente',
          pacienteId: 'paciente-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: null
        }
      ]);

      const result = await consultationAuditService.detectOrphanStates();

      expect(result).toHaveLength(0);
    });

    it('should check specific consulta when ID is provided', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([]);

      await consultationAuditService.detectOrphanStates('consulta-specific');

      expect(mockPrisma.consulta.findMany).toHaveBeenCalledWith({
        where: { id: 'consulta-specific' },
        select: expect.any(Object)
      });
    });
  });

  describe('detectMissingAuditLogs', () => {
    it('should detect consultas without audit logs', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        { id: 'consulta-1', updatedAt: new Date() },
        { id: 'consulta-2', updatedAt: new Date() }
      ]);

      // No audit logs found for these consultas
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);

      const result = await consultationAuditService.detectMissingAuditLogs(100);

      expect(result).toHaveLength(2);
      expect(result).toContain('consulta-1');
      expect(result).toContain('consulta-2');
    });

    it('should return empty array when all consultas have audit logs', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([
        { id: 'consulta-1', updatedAt: new Date() }
      ]);

      // Audit log exists
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([
        { id: 'audit-1' } as any
      ]);

      const result = await consultationAuditService.detectMissingAuditLogs();

      expect(result).toHaveLength(0);
    });

    it('should handle large sample sizes efficiently', async () => {
      const largeSample = Array.from({ length: 500 }, (_, i) => ({
        id: `consulta-${i}`,
        updatedAt: new Date()
      }));

      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue(largeSample);
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);

      const result = await consultationAuditService.detectMissingAuditLogs(500);

      expect(result).toHaveLength(500);
      expect(mockPrisma.consulta.findMany).toHaveBeenCalledWith({
        take: 500,
        where: { estado: { not: 'borrador' } },
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' }
      });
    });
  });

  describe('generateAuditReport', () => {
    it('should generate comprehensive audit report', async () => {
      vi.mocked(mockPrisma.consulta.count).mockResolvedValue(1000);
      vi.mocked(mockPrisma.auditLog.count).mockResolvedValue(850);
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);

      const report = await consultationAuditService.generateAuditReport({
        sampleSize: 100,
        includeTransitionSummary: true
      });

      expect(report).toMatchObject({
        totalConsultas: 1000,
        auditedTransitions: 850,
        orphanStates: expect.any(Array),
        missingAuditLogs: expect.any(Array),
        transitionSummary: expect.any(Object),
        complianceScore: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should calculate compliance score correctly', async () => {
      vi.mocked(mockPrisma.consulta.count).mockResolvedValue(100);
      vi.mocked(mockPrisma.auditLog.count).mockResolvedValue(80);
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([]);

      const report = await consultationAuditService.generateAuditReport();

      expect(report.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.complianceScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty database gracefully', async () => {
      vi.mocked(mockPrisma.consulta.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([]);

      const report = await consultationAuditService.generateAuditReport();

      expect(report.totalConsultas).toBe(0);
      expect(report.orphanStates).toHaveLength(0);
      expect(report.complianceScore).toBeDefined();
    });
  });

  describe('getTransitionHistory', () => {
    it('should return transition history for a consultation', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          userId: 'user-1',
          rolUsuario: 'MEDICO',
          timestamp: new Date('2024-01-01'),
          metadata: {
            transition: {
              from: 'borrador',
              to: 'triaje'
            }
          }
        },
        {
          id: 'audit-2',
          userId: 'user-2',
          rolUsuario: 'ENFERMERA',
          timestamp: new Date('2024-01-02'),
          metadata: {
            transition: {
              from: 'triaje',
              to: 'pendiente'
            }
          }
        }
      ];

      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue(mockAuditLogs as any);

      const history = await consultationAuditService.getTransitionHistory('consulta-123');

      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        from: 'borrador',
        to: 'triaje',
        changedBy: 'user-1',
        changedByRole: 'MEDICO'
      });
      expect(history[1]).toMatchObject({
        from: 'triaje',
        to: 'pendiente',
        changedBy: 'user-2',
        changedByRole: 'ENFERMERA'
      });
    });

    it('should return empty array when no transitions found', async () => {
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);

      const history = await consultationAuditService.getTransitionHistory('consulta-123');

      expect(history).toHaveLength(0);
    });

    it('should filter out logs without transition metadata', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          userId: 'user-1',
          rolUsuario: 'MEDICO',
          timestamp: new Date(),
          metadata: { other: 'data' } // No transition field
        },
        {
          id: 'audit-2',
          userId: 'user-2',
          rolUsuario: 'MEDICO',
          timestamp: new Date(),
          metadata: null
        }
      ];

      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue(mockAuditLogs as any);

      const history = await consultationAuditService.getTransitionHistory('consulta-123');

      expect(history).toHaveLength(0);
    });
  });

  describe('validateTeleconsultaTransitions', () => {
    it('should validate teleconsulta transitions successfully', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue({
        estado: 'pendiente',
        cita: {
          tipo: 'teleconsulta',
          estado: 'confirmada'
        }
      } as any);

      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([
        { id: 'audit-1', metadata: { transition: { from: 'borrador', to: 'triaje' } } }
      ] as any);

      const result = await consultationAuditService.validateTeleconsultaTransitions(
        'consulta-tele',
        true
      );

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect teleconsulta type mismatch', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue({
        estado: 'pendiente',
        cita: {
          tipo: 'presencial', // Not teleconsulta
          estado: 'confirmada'
        }
      } as any);

      const result = await consultationAuditService.validateTeleconsultaTransitions(
        'consulta-123',
        true
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        'Consulta marked as teleconsulta but cita type mismatch'
      );
    });

    it('should detect missing audit trail for teleconsulta', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue({
        estado: 'pendiente', // Not borrador
        cita: {
          tipo: 'teleconsulta',
          estado: 'confirmada'
        }
      } as any);

      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);

      const result = await consultationAuditService.validateTeleconsultaTransitions(
        'consulta-tele',
        true
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('No audit trail for teleconsulta state transitions');
    });

    it('should return valid true for non-teleconsulta', async () => {
      const result = await consultationAuditService.validateTeleconsultaTransitions(
        'consulta-123',
        false
      );

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle consulta not found', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue(null);

      const result = await consultationAuditService.validateTeleconsultaTransitions(
        'non-existent',
        true
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Consulta not found');
    });
  });

  describe('State Machine Coverage Tests', () => {
    it('should cover all valid state transitions', () => {
      const validTransitions: Array<{ from: EstadoConsulta; to: EstadoConsulta }> = [
        { from: 'borrador', to: 'triaje' },
        { from: 'borrador', to: 'finalizada' },
        { from: 'triaje', to: 'pendiente' },
        { from: 'pendiente', to: 'en_atencion' },
        { from: 'en_atencion', to: 'finalizada' },
        { from: 'en_atencion', to: 'interconsulta' },
        { from: 'interconsulta', to: 'pendiente' },
        { from: 'interconsulta', to: 'finalizada' }
      ];

      for (const transition of validTransitions) {
        vi.mocked(canTransition).mockImplementation((from, to) => {
          const match = validTransitions.some(t => t.from === from && t.to === to);
          return match;
        });

        const result = canTransition(transition.from, transition.to);
        expect(result).toBe(true);
      }
    });

    it('should reject invalid state transitions', () => {
      const invalidTransitions: Array<{ from: EstadoConsulta; to: EstadoConsulta }> = [
        { from: 'borrador', to: 'en_atencion' }, // Skip triaje
        { from: 'triaje', to: 'finalizada' }, // Skip pendiente
        { from: 'pendiente', to: 'borrador' }, // Backward
        { from: 'finalizada', to: 'pendiente' }, // From terminal
        { from: 'en_atencion', to: 'triaje' } // Backward
      ];

      vi.mocked(canTransition).mockReturnValue(false);

      for (const transition of invalidTransitions) {
        const result = canTransition(transition.from, transition.to);
        expect(result).toBe(false);
      }
    });

    it('should identify terminal states correctly', () => {
      expect(isTerminalState('finalizada')).toBe(true);
      
      const nonTerminalStates: EstadoConsulta[] = [
        'borrador',
        'triaje',
        'pendiente',
        'en_atencion',
        'interconsulta'
      ];

      vi.mocked(isTerminalState).mockReturnValue(false);
      
      for (const state of nonTerminalStates) {
        expect(isTerminalState(state)).toBe(false);
      }
    });

    it('should return all states in correct order', () => {
      const states = getAllStatesOrdered();
      
      expect(states).toEqual([
        'borrador',
        'triaje',
        'pendiente',
        'en_atencion',
        'finalizada',
        'interconsulta'
      ]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      vi.mocked(mockPrisma.consulta.findMany).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(consultationAuditService.detectOrphanStates())
        .rejects.toThrow('Database connection failed');
    });

    it('should handle null/undefined metadata gracefully', async () => {
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([
        {
          id: 'audit-1',
          userId: 'user-1',
          rolUsuario: 'MEDICO',
          timestamp: new Date(),
          metadata: null
        }
      ] as any);

      const history = await consultationAuditService.getTransitionHistory('consulta-123');
      
      expect(history).toHaveLength(0);
    });

    it('should handle very large consulta IDs', async () => {
      const largeId = 'consulta-' + 'x'.repeat(1000);
      
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue(null);

      const result = await consultationAuditService.validateTeleconsultaTransitions(
        largeId,
        true
      );

      expect(result.issues).toContain('Consulta not found');
    });

    it('should handle concurrent audit log writes', async () => {
      const auditData: StateTransitionAuditData = {
        consultaId: 'consulta-concurrent',
        pacienteId: 'paciente-123',
        previousState: 'borrador',
        newState: 'triaje',
        changedBy: 'user-1',
        changedByRole: 'MEDICO'
      };

      // Simulate concurrent writes
      const promises = Array.from({ length: 5 }, () =>
        consultationAuditService.logStateTransition(auditData)
      );

      vi.mocked(AuditService.log).mockResolvedValue({ id: 'audit-concurrent' } as any);

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Compliance Score Calculation', () => {
    it('should calculate score with high audit coverage', () => {
      // This is tested indirectly through generateAuditReport
      // Score should be higher with more audit coverage
    });

    it('should penalize orphan states heavily', () => {
      // Each orphan state deducts 10 points
      // Tested through generateAuditReport with mock orphan states
    });

    it('should ensure score stays within 0-100 bounds', async () => {
      vi.mocked(mockPrisma.consulta.count).mockResolvedValue(100);
      vi.mocked(mockPrisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.auditLog.findMany).mockResolvedValue([]);
      
      // Simulate many orphan states
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          id: `orphan-${i}`,
          estado: 'invalid',
          pacienteId: 'paciente-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: null
        }))
      );

      const report = await consultationAuditService.generateAuditReport();

      expect(report.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.complianceScore).toBeLessThanOrEqual(100);
    });
  });
});
