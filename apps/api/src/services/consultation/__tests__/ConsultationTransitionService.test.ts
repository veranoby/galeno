import { describe, it, expect, vi, beforeEach } from 'vitest';

const publishMock = vi.fn().mockResolvedValue(true);
const mockEventBus = { publish: publishMock };

import * as eventBusModule from '../../../events/EventBus.js';
vi.spyOn(eventBusModule, 'getEventBus').mockReturnValue(mockEventBus as any);

import { ConsultationTransitionService, ConsultationTransitionError } from '../ConsultationTransitionService.js';

describe('ConsultationTransitionService', () => {
  let transitionService: ConsultationTransitionService;

  beforeEach(() => {
    transitionService = new ConsultationTransitionService();
    vi.clearAllMocks();
    publishMock.mockClear();
  });

  describe('validateTransition', () => {
    it('allows valid transitions', () => {
      expect(() => transitionService.validateTransition('borrador', 'triaje', 'DOCTOR')).not.toThrow();
      expect(() => transitionService.validateTransition('borrador', 'pendiente', 'DOCTOR')).not.toThrow();
      expect(() => transitionService.validateTransition('pendiente', 'en_atencion', 'DOCTOR')).not.toThrow();
      expect(() => transitionService.validateTransition('en_atencion', 'finalizada', 'DOCTOR')).not.toThrow();
      expect(() => transitionService.validateTransition('en_atencion', 'interconsulta', 'DOCTOR')).not.toThrow();
      expect(() => transitionService.validateTransition('interconsulta', 'finalizada', 'DOCTOR')).not.toThrow();
    });

    it('rejects invalid transitions', () => {
      expect(() => transitionService.validateTransition('borrador', 'en_atencion', 'DOCTOR'))
        .toThrow(ConsultationTransitionError);
      expect(() => transitionService.validateTransition('triaje', 'finalizada', 'ENFERMERA'))
        .toThrow(ConsultationTransitionError);
      expect(() => transitionService.validateTransition('pendiente', 'finalizada', 'DOCTOR'))
        .toThrow(ConsultationTransitionError);
    });

    it('rejects transitions from a terminal state', () => {
      expect(() => transitionService.validateTransition('finalizada', 'en_atencion', 'DOCTOR'))
        .toThrow(ConsultationTransitionError);
      expect(() => transitionService.validateTransition('finalizada', 'borrador', 'DOCTOR'))
        .toThrow(ConsultationTransitionError);
    });

    it('enforces role restrictions from triaje', () => {
      // Valid roles
      expect(() => transitionService.validateTransition('triaje', 'pendiente', 'ENFERMERA')).not.toThrow();
      expect(() => transitionService.validateTransition('triaje', 'en_atencion', 'ASISTENTE')).not.toThrow();
      expect(() => transitionService.validateTransition('triaje', 'en_atencion', 'enfermera')).not.toThrow();
      expect(() => transitionService.validateTransition('triaje', 'en_atencion', 'asistente')).not.toThrow();

      // Invalid roles
      expect(() => transitionService.validateTransition('triaje', 'pendiente', 'DOCTOR'))
        .toThrow(ConsultationTransitionError);
      expect(() => transitionService.validateTransition('triaje', 'en_atencion', 'PACIENTE'))
        .toThrow(ConsultationTransitionError);
    });
  });

  describe('transitionState', () => {
    it('publishes event via event bus on successful transition', async () => {
      await transitionService.transitionState('cons-1', 'pendiente', 'en_atencion', 'DOCTOR', 'doc-1', 'John Doe');

      expect(publishMock).toHaveBeenCalledTimes(1);
      const publishedEvent = publishMock.mock.calls[0][0];

      expect(publishedEvent.eventType).toBe('ConsultationStatusChanged');
      expect(publishedEvent.data.consultationId).toBe('cons-1');
      expect(publishedEvent.data.previousStatus).toBe('pendiente');
      expect(publishedEvent.data.newStatus).toBe('en_atencion');
      expect(publishedEvent.data.doctorId).toBe('doc-1');
      expect(publishedEvent.data.patientName).toBe('John Doe');
    });

    it('does nothing if current status matches next status', async () => {
      await transitionService.transitionState('cons-1', 'pendiente', 'pendiente', 'DOCTOR', 'doc-1');

      expect(publishMock).not.toHaveBeenCalled();
    });

    it('throws on invalid transition without publishing event', async () => {
      await expect(
        transitionService.transitionState('cons-1', 'borrador', 'en_atencion', 'DOCTOR', 'doc-1')
      ).rejects.toThrow(ConsultationTransitionError);

      expect(publishMock).not.toHaveBeenCalled();
    });
  });
});
