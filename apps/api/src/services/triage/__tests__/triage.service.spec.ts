
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    consulta: {
      update: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    }
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
    EstadoConsulta: {
      borrador: 'borrador',
      triaje: 'triaje',
      pendiente: 'pendiente',
      en_atencion: 'en_atencion',
      finalizada: 'finalizada',
      interconsulta: 'interconsulta',
    }
  };
});

vi.mock('../../sse/sse-manager.js', () => ({
  sseManager: {
    sendToUser: vi.fn(),
    sendTriageUpdate: vi.fn(),
  },
}));

vi.mock('../stateMachine.js', () => ({
  validateTransition: vi.fn(),
  canTransition: vi.fn(),
  getNextStates: vi.fn(),
}));

import { triageService } from '../triage.service';

describe('TriageService', () => {
  const mockPrisma = new PrismaClient() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureTriage', () => {
    it('should successfully capture triage data without mutating status', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue({ id: '1', estado: 'borrador' });
      vi.mocked(mockPrisma.consulta.update).mockResolvedValue({ id: '1', triajeData: { weight: 70 } });

      await triageService.captureTriage('1', { weight: 70 }, 'nurse1');

      expect(mockPrisma.consulta.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          triajeData: { weight: 70 },
          updatedAt: expect.any(Date)
        },
        include: { paciente: true, doctor: true }
      });
    });
  });

  describe('getTriageData', () => {
    it('should return triage data', async () => {
      vi.mocked(mockPrisma.consulta.findUnique).mockResolvedValue({ id: '1', triajeData: { weight: 70 }, estado: 'borrador' });
      const res = await triageService.getTriageData('1');
      expect(res).toEqual({ triajeData: { weight: 70 }, estado: 'borrador' });
    });
  });

  describe('bulkUpdateTriageStatus', () => {
    it('should bulk update', async () => {
      vi.mocked(mockPrisma.consulta.updateMany).mockResolvedValue({ count: 2 });
      vi.mocked(mockPrisma.consulta.findMany).mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const res = await triageService.bulkUpdateTriageStatus(['1', '2'], 'pendiente', 'nurse1');
      expect(res).toBe(2);
    });
  });
});
