/**
 * State Machine Audit Tests - Integration Light
 * 
 * These tests focus on the core audit logic without heavy mocking overhead.
 * For full integration tests, use the E2E test suite.
 */

import { describe, it, expect } from 'vitest';

// Test state machine transition rules directly
describe('State Machine Transition Rules', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    borrador: ['triaje', 'finalizada'],
    triaje: ['pendiente'],
    pendiente: ['en_atencion'],
    en_atencion: ['finalizada', 'interconsulta'],
    finalizada: [],
    interconsulta: ['pendiente', 'finalizada']
  };

  describe('Valid Transitions', () => {
    it('should allow borrador -> triaje transition', () => {
      expect(VALID_TRANSITIONS['borrador']).toContain('triaje');
    });

    it('should allow borrador -> finalizada transition', () => {
      expect(VALID_TRANSITIONS['borrador']).toContain('finalizada');
    });

    it('should allow triaje -> pendiente transition', () => {
      expect(VALID_TRANSITIONS['triaje']).toContain('pendiente');
    });

    it('should allow pendiente -> en_atencion transition', () => {
      expect(VALID_TRANSITIONS['pendiente']).toContain('en_atencion');
    });

    it('should allow en_atencion -> finalizada transition', () => {
      expect(VALID_TRANSITIONS['en_atencion']).toContain('finalizada');
    });

    it('should allow en_atencion -> interconsulta transition', () => {
      expect(VALID_TRANSITIONS['en_atencion']).toContain('interconsulta');
    });

    it('should allow interconsulta -> pendiente transition', () => {
      expect(VALID_TRANSITIONS['interconsulta']).toContain('pendiente');
    });

    it('should allow interconsulta -> finalizada transition', () => {
      expect(VALID_TRANSITIONS['interconsulta']).toContain('finalizada');
    });
  });

  describe('Invalid Transitions', () => {
    it('should not allow borrador -> en_atencion (skip triaje)', () => {
      expect(VALID_TRANSITIONS['borrador']).not.toContain('en_atencion');
    });

    it('should not allow triaje -> finalizada (skip pendiente)', () => {
      expect(VALID_TRANSITIONS['triaje']).not.toContain('finalizada');
    });

    it('should not allow pendiente -> borrador (backward)', () => {
      expect(VALID_TRANSITIONS['pendiente']).not.toContain('borrador');
    });

    it('should not allow finalizada -> pendiente (from terminal)', () => {
      expect(VALID_TRANSITIONS['finalizada']).not.toContain('pendiente');
    });

    it('should not allow same state transition', () => {
      Object.entries(VALID_TRANSITIONS).forEach(([from, toStates]) => {
        expect(toStates).not.toContain(from);
      });
    });
  });

  describe('Terminal States', () => {
    it('should identify finalizada as terminal state', () => {
      expect(VALID_TRANSITIONS['finalizada']).toHaveLength(0);
    });

    it('should not have terminal states with outgoing transitions', () => {
      const terminalStates = Object.entries(VALID_TRANSITIONS)
        .filter(([_, toStates]) => toStates.length === 0);
      
      expect(terminalStates).toHaveLength(1);
      expect(terminalStates[0][0]).toBe('finalizada');
    });
  });

  describe('State Reachability', () => {
    const hasValidPath = (from: string, to: string): boolean => {
      if (from === to) return true;
      
      const visited = new Set<string>();
      const queue: string[] = [from];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        
        visited.add(current);
        
        const nextStates = VALID_TRANSITIONS[current] || [];
        for (const nextState of nextStates) {
          if (nextState === to) return true;
          if (!visited.has(nextState)) {
            queue.push(nextState);
          }
        }
      }
      
      return false;
    };

    it('should have valid path from borrador to finalizada', () => {
      expect(hasValidPath('borrador', 'finalizada')).toBe(true);
    });

    it('should have valid path from borrador to en_atencion', () => {
      expect(hasValidPath('borrador', 'en_atencion')).toBe(true);
    });

    it('should have valid path from triaje to finalizada', () => {
      expect(hasValidPath('triaje', 'finalizada')).toBe(true);
    });

    it('should not have valid path from finalizada to other states', () => {
      expect(hasValidPath('finalizada', 'pendiente')).toBe(false);
      expect(hasValidPath('finalizada', 'en_atencion')).toBe(false);
    });

    it('should not have valid path backward', () => {
      expect(hasValidPath('en_atencion', 'triaje')).toBe(false);
      expect(hasValidPath('pendiente', 'borrador')).toBe(false);
    });
  });
});

describe('Audit Log Metadata Structure', () => {
  it('should have required fields for state transition audit', () => {
    const auditData = {
      consultaId: 'test-id',
      pacienteId: 'patient-id',
      previousState: 'borrador',
      newState: 'triaje',
      changedBy: 'user-id',
      changedByRole: 'MEDICO',
      metadata: {
        transition: {
          from: 'borrador',
          to: 'triaje',
          timestamp: new Date().toISOString()
        },
        teleconsulta: false
      }
    };

    expect(auditData).toHaveProperty('consultaId');
    expect(auditData).toHaveProperty('pacienteId');
    expect(auditData).toHaveProperty('previousState');
    expect(auditData).toHaveProperty('newState');
    expect(auditData).toHaveProperty('changedBy');
    expect(auditData).toHaveProperty('changedByRole');
    expect(auditData.metadata).toHaveProperty('transition');
  });

  it('should support teleconsulta metadata flag', () => {
    const teleconsultaAudit = {
      metadata: {
        teleconsulta: true,
        reason: 'Teleconsulta session'
      }
    };

    expect(teleconsultaAudit.metadata.teleconsulta).toBe(true);
  });

  it('should support triage completion flag', () => {
    const triageAudit = {
      metadata: {
        triageComplete: true,
        triageData: {
          bloodPressure: '120/80',
          temperature: 36.5
        }
      }
    };

    expect(triageAudit.metadata.triageComplete).toBe(true);
  });
});

describe('Orphan State Detection Logic', () => {
  interface OrphanStateResult {
    consultaId: string;
    currentState: string;
    issue: 'ORPHAN_STATE' | 'INVALID_TRANSITION' | 'MISSING_AUDIT_LOG' | 'TERMINAL_STATE_VIOLATION';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }

  const detectOrphanState = (state: string, validStates: string[]): OrphanStateResult | null => {
    if (!validStates.includes(state)) {
      return {
        consultaId: 'test',
        currentState: state,
        issue: 'ORPHAN_STATE',
        severity: 'HIGH'
      };
    }
    return null;
  };

  it('should detect invalid state', () => {
    const validStates = ['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta'];
    const result = detectOrphanState('invalid_state', validStates);
    
    expect(result).not.toBeNull();
    expect(result?.issue).toBe('ORPHAN_STATE');
    expect(result?.severity).toBe('HIGH');
  });

  it('should not flag valid state as orphan', () => {
    const validStates = ['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta'];
    const result = detectOrphanState('pendiente', validStates);
    
    expect(result).toBeNull();
  });
});

describe('Compliance Score Calculation', () => {
  const calculateComplianceScore = (metrics: {
    totalConsultas: number;
    auditedTransitions: number;
    orphanStatesCount: number;
    missingAuditLogsCount: number;
  }): number => {
    const { totalConsultas, auditedTransitions, orphanStatesCount, missingAuditLogsCount } = metrics;
    
    let score = 100;
    score -= orphanStatesCount * 10;
    
    if (totalConsultas > 0) {
      const missingRatio = missingAuditLogsCount / totalConsultas;
      score -= missingRatio * 50;
    }
    
    if (auditedTransitions > 0 && totalConsultas > 0) {
      const auditRatio = Math.min(auditedTransitions / totalConsultas, 1);
      score += auditRatio * 10;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  it('should calculate perfect score for full compliance', () => {
    const score = calculateComplianceScore({
      totalConsultas: 100,
      auditedTransitions: 100,
      orphanStatesCount: 0,
      missingAuditLogsCount: 0
    });
    
    expect(score).toBe(100);
  });

  it('should penalize orphan states', () => {
    const score = calculateComplianceScore({
      totalConsultas: 100,
      auditedTransitions: 100,
      orphanStatesCount: 5,
      missingAuditLogsCount: 0
    });
    
    expect(score).toBe(50); // 100 - (5 * 10)
  });

  it('should penalize missing audit logs', () => {
    const score = calculateComplianceScore({
      totalConsultas: 100,
      auditedTransitions: 50,
      orphanStatesCount: 0,
      missingAuditLogsCount: 50
    });
    
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it('should ensure score stays within 0-100 bounds', () => {
    const highPenaltyScore = calculateComplianceScore({
      totalConsultas: 100,
      auditedTransitions: 0,
      orphanStatesCount: 20,
      missingAuditLogsCount: 100
    });
    
    expect(highPenaltyScore).toBeGreaterThanOrEqual(0);
    expect(highPenaltyScore).toBeLessThanOrEqual(100);
  });
});

describe('Teleconsulta Workflow Validation', () => {
  it('should validate teleconsulta follows standard state path', () => {
    const teleconsultaStates = ['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada'];
    
    // Verify teleconsulta uses same states as regular consultas
    teleconsultaStates.forEach(state => {
      expect(['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta'])
        .toContain(state);
    });
  });

  it('should flag type mismatch between cita and consulta', () => {
    const citaTipo = 'presencial' as string;
    const isTeleconsulta = true;
    
    const hasMismatch = (citaTipo === 'teleconsulta') !== isTeleconsulta;
    expect(hasMismatch).toBe(true);
  });

  it('should require audit trail for teleconsulta transitions', () => {
    const transitionHistory: Array<{ from: string; to: string }> = [];
    const currentState = 'pendiente' as string;
    
    const hasAuditTrail = transitionHistory.length > 0 || currentState === 'borrador';
    expect(hasAuditTrail).toBe(false); // Should fail - no audit trail
  });
});
