import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma first before importing the service
const mockPrisma = {
  consulta: {
    update: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  EstadoConsulta: {
    borrador: 'borrador',
    triaje: 'triaje',
    pendiente: 'pendiente',
    en_atencion: 'en_atencion',
    finalizada: 'finalizada',
    interconsulta: 'interconsulta',
  }
}));

// Mock SSE Manager
const mockSSEManager = {
  sendToUser: vi.fn(),
  sendTriageUpdate: vi.fn(),
};

vi.mock('../../sse/sse-manager.js', () => ({
  sseManager: mockSSEManager,
}));

// Mock State Machine
vi.mock('../stateMachine.js', () => ({
  validateTransition: vi.fn(),
  canTransition: vi.fn(),
  getNextStates: vi.fn(),
}));

// Now import the service after mocks are set up
import { triageService } from '../triage.service';
import { validateTransition } from '../../stateMachine.js';
import { sseManager } from '../../sse/sse-manager.js';

describe('TriageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('captureTriage', () => {
    it('should successfully capture triage data and transition state from borrador to triaje', async () => {
      const consultaId = 'test-consulta-id';
      const triageData = {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 36.5,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        weight: 70,
        height: 175,
        notes: 'Patient in good condition',
      };
      const updatedById = 'nurse-id-123';

      const mockConsulta = {
        id: consultaId,
        estado: 'triaje',
        triajeData: triageData,
        pacienteId: 'patient-123',
        doctorId: 'doctor-456',
        paciente: {
          nombre: 'John',
          apellido: 'Doe',
        },
        doctor: {
          id: 'doctor-456',
        },
      };

      // Mock state machine validation
      vi.mocked(validateTransition).mockImplementation(() => {
        // Allow borrador -> triaje transition
        return undefined;
      });

      // Mock Prisma update
      mockPrisma.consulta.update.mockResolvedValue(mockConsulta);

      const result = await triageService.captureTriage(consultaId, triageData, updatedById);

      expect(mockPrisma.consulta.update).toHaveBeenCalledWith({
        where: { id: consultaId },
        data: {
          triajeData: triageData,
          estado: 'triaje',
          updatedAt: expect.any(Date),
        },
        include: {
          paciente: true,
          doctor: true,
        },
      });

      expect(result).toEqual(mockConsulta);
      expect(sseManager.sendToUser).not.toHaveBeenCalled(); // Should not notify doctor yet
    });

    it('should transition to pendiente and notify doctor when triage is completed', async () => {
      const consultaId = 'test-consulta-id';
      const triageData = {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 36.5,
        isComplete: true, // Flag indicating triage is complete
      };
      const updatedById = 'nurse-id-123';

      const mockConsulta = {
        id: consultaId,
        estado: 'pendiente',
        triajeData: triageData,
        pacienteId: 'patient-123',
        doctorId: 'doctor-456',
        paciente: {
          nombre: 'John',
          apellido: 'Doe',
        },
        doctor: {
          id: 'doctor-456',
        },
      };

      // Mock state machine validation for triaje -> pendiente
      vi.mocked(validateTransition).mockImplementation(() => undefined);

      mockPrisma.consulta.update.mockResolvedValue(mockConsulta);

      const result = await triageService.captureTriage(consultaId, triageData, updatedById);

      expect(mockPrisma.consulta.update).toHaveBeenCalledWith({
        where: { id: consultaId },
        data: {
          triajeData: triageData,
          estado: 'pendiente',
          updatedAt: expect.any(Date),
        },
        include: {
          paciente: true,
          doctor: true,
        },
      });

      // Should notify doctor when transitioning to pendiente
      expect(sseManager.sendToUser).toHaveBeenCalledWith('doctor-456', expect.objectContaining({
        type: 'TRIAGE_COMPLETED',
        data: expect.objectContaining({
          consultaId,
          pacienteId: 'patient-123',
        }),
      }));

      expect(result).toEqual(mockConsulta);
    });

    it('should reject invalid state transition', async () => {
      const consultaId = 'test-consulta-id';
      const triageData = { bloodPressure: '120/80' };
      const updatedById = 'nurse-id-123';

      // Mock state machine to reject transition (e.g., from en_atencion)
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new Error('Invalid state transition: en_atencion -> triaje');
      });

      await expect(triageService.captureTriage(consultaId, triageData, updatedById))
        .rejects.toThrow('Invalid state transition');

      expect(mockPrisma.consulta.update).not.toHaveBeenCalled();
      expect(sseManager.sendToUser).not.toHaveBeenCalled();
    });

    it('should handle Prisma errors gracefully', async () => {
      const consultaId = 'test-consulta-id';
      const triageData = { bloodPressure: '120/80' };
      const updatedById = 'nurse-id-123';

      vi.mocked(validateTransition).mockImplementation(() => undefined);
      mockPrisma.consulta.update.mockRejectedValue(new Error('Database error'));

      await expect(triageService.captureTriage(consultaId, triageData, updatedById))
        .rejects.toThrow('Database error');
    });
  });

  describe('getTriageData', () => {
    it('should return triage data for a consultation', async () => {
      const consultaId = 'test-consulta-id';
      const mockTriageData = {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 36.5,
      };

      mockPrisma.consulta.findUnique.mockResolvedValue({
        id: consultaId,
        triajeData: mockTriageData,
        estado: 'triaje',
      });

      const result = await triageService.getTriageData(consultaId);

      expect(mockPrisma.consulta.findUnique).toHaveBeenCalledWith({
        where: { id: consultaId },
        select: { triajeData: true, estado: true },
      });

      expect(result).toEqual({
        triajeData: mockTriageData,
        estado: 'triaje',
      });
    });

    it('should return null when consultation has no triage data', async () => {
      const consultaId = 'test-consulta-id';

      mockPrisma.consulta.findUnique.mockResolvedValue({
        id: consultaId,
        triajeData: null,
        estado: 'borrador',
      });

      const result = await triageService.getTriageData(consultaId);

      expect(result).toEqual({
        triajeData: null,
        estado: 'borrador',
      });
    });

    it('should handle errors when fetching triage data', async () => {
      const consultaId = 'test-consulta-id';
      mockPrisma.consulta.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(triageService.getTriageData(consultaId))
        .rejects.toThrow('Database error');
    });
  });

  describe('bulkUpdateTriageStatus', () => {
    it('should bulk update triage status for multiple consultations', async () => {
      const consultaIds = ['id1', 'id2', 'id3'];
      const newStatus = 'pendiente';
      const updatedById = 'nurse-id-123';

      const mockConsultas = [
        { id: 'id1', doctorId: 'doctor-1', pacienteId: 'patient-1', paciente: { nombre: 'John', apellido: 'Doe' }, doctor: { id: 'doctor-1' } },
        { id: 'id2', doctorId: 'doctor-2', pacienteId: 'patient-2', paciente: { nombre: 'Jane', apellido: 'Smith' }, doctor: { id: 'doctor-2' } },
      ];

      mockPrisma.consulta.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.consulta.findMany.mockResolvedValue(mockConsultas);

      const result = await triageService.bulkUpdateTriageStatus(consultaIds, newStatus, updatedById);

      expect(mockPrisma.consulta.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: consultaIds },
          estado: { in: ['borrador', 'triaje'] },
        },
        data: {
          estado: newStatus,
          updatedAt: expect.any(Date),
        },
      });

      // Should notify doctors for each consultation
      expect(sseManager.sendToUser).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });

    it('should only notify doctors when transitioning to pendiente', async () => {
      const consultaIds = ['id1', 'id2'];
      const newStatus = 'triaje'; // Not pendiente

      mockPrisma.consulta.updateMany.mockResolvedValue({ count: 2 });

      await triageService.bulkUpdateTriageStatus(consultaIds, newStatus, 'nurse-id');

      // Should NOT notify doctors when not transitioning to pendiente
      expect(sseManager.sendToUser).not.toHaveBeenCalled();
      expect(mockPrisma.consulta.findMany).not.toHaveBeenCalled();
    });

    it('should handle bulk update errors', async () => {
      const consultaIds = ['id1', 'id2'];
      const newStatus = 'pendiente';

      mockPrisma.consulta.updateMany.mockRejectedValue(new Error('Bulk update failed'));

      await expect(triageService.bulkUpdateTriageStatus(consultaIds, newStatus, 'nurse-id'))
        .rejects.toThrow('Bulk update failed');
    });
  });

  describe('validateTriageTransition', () => {
    it('should validate triaje -> pendiente transition', () => {
      vi.mocked(validateTransition).mockImplementation(() => undefined);
      
      expect(() => triageService.validateTriageTransition('triaje', 'pendiente'))
        .not.toThrow();
    });

    it('should reject invalid transitions', () => {
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new Error('Invalid transition');
      });
      
      expect(() => triageService.validateTriageTransition('en_atencion', 'triaje'))
        .toThrow('Invalid transition');
    });
  });
});
