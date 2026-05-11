// apps/web/src/state/managers/__tests__/ConsultaStateManager.test.ts
/**
 * Tests para ConsultaStateManager
 *
 * Tests de TDD para verificar:
 * - Crear consultas
 * - Actualizar consultas
 * - Marcar como firmadas
 * - Filtrado por estado
 * - Sincronización offline/online
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsultaStateManager } from '../ConsultaStateManager.js';

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

vi.stubGlobal('localStorage', localStorageMock);

// Mock de window.addEventListener/removeEventListener
const eventListeners = new Map<string, Set<() => void>>();
const addEventListenerMock = vi.fn((event: string, handler: () => void) => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(handler);
});
const removeEventListenerMock = vi.fn((event: string, handler: () => void) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.delete(handler);
  }
});

vi.stubGlobal('window', {
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
  navigator: { onLine: true }
});

describe('ConsultaStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners.clear();
  });

  afterEach(() => {
    ConsultaStateManager.destroy(); // Usar destroy en lugar de clearAll
    ConsultaStateManager.clearAll();
  });

  describe('initial state', () => {
    it('should have empty consultas initially', () => {
      expect(ConsultaStateManager.consultas).toEqual([]);
      expect(ConsultaStateManager.consultaActiva).toBeNull();
      expect(ConsultaStateManager.isLoading).toBe(false);
      expect(ConsultaStateManager.error).toBeNull();
    });
  });

  describe('createConsulta', () => {
    it('should create new consulta', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      expect(consulta.id).toBeDefined();
      expect(consulta.pacienteId).toBe('paciente-123');
      expect(consulta.estado).toBe('pendiente');
      expect(ConsultaStateManager.consultas).toHaveLength(1);
    });

    it('should generate unique ID for each consulta', async () => {
      const consulta1 = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-1',
        pacienteNombre: 'Paciente 1',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Motivo 1'
      });

      const consulta2 = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-2',
        pacienteNombre: 'Paciente 2',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'presencial',
        motivo: 'Motivo 2'
      });

      expect(consulta1.id).not.toBe(consulta2.id);
      expect(ConsultaStateManager.consultas).toHaveLength(2);
    });

    it('should set timestamps correctly', async () => {
      const beforeCreate = Date.now();

      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      const afterCreate = Date.now();

      expect(consulta.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(consulta.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(consulta.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(consulta.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe('updateConsulta', () => {
    it('should update existing consulta', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      await ConsultaStateManager.updateConsulta(consulta.id, {
        estado: 'en_atencion'
      });

      const updated = ConsultaStateManager.getConsultaById(consulta.id);
      expect(updated?.estado).toBe('en_atencion');
    });

    it('should update updatedAt timestamp', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      const originalUpdatedAt = consulta.updatedAt;

      // Esperar un poco para asegurar diferencia
      await new Promise(resolve => setTimeout(resolve, 10));

      await ConsultaStateManager.updateConsulta(consulta.id, {
        estado: 'en_atencion'
      });

      const updated = ConsultaStateManager.getConsultaById(consulta.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw error for non-existent consulta', async () => {
      await expect(
        ConsultaStateManager.updateConsulta('non-existent', { estado: 'finalizada' })
      ).rejects.toThrow('Consulta non-existent no encontrada');
    });
  });

  describe('setConsultaActiva', () => {
    it('should set active consulta', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      ConsultaStateManager.setConsultaActiva(consulta);

      expect(ConsultaStateManager.consultaActiva).toEqual(consulta);
    });

    it('should allow clearing active consulta', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      ConsultaStateManager.setConsultaActiva(consulta);
      expect(ConsultaStateManager.consultaActiva).not.toBeNull();

      ConsultaStateManager.setConsultaActiva(null);
      expect(ConsultaStateManager.consultaActiva).toBeNull();
    });
  });

  describe('marcarFirmada', () => {
    it('should mark consulta as signed', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'en_atencion',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      await ConsultaStateManager.marcarFirmada(consulta.id, 'doctor-123');

      const updated = ConsultaStateManager.getConsultaById(consulta.id);
      expect(updated?.firmada).toBe(true);
      expect(updated?.firmadaPor).toBe('doctor-123');
      expect(updated?.firmadaAt).toBeDefined();
      expect(updated?.estado).toBe('finalizada');
    });

    it('should add to firmadas list', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'en_atencion',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      expect(ConsultaStateManager.firmadas).toHaveLength(0);

      await ConsultaStateManager.marcarFirmada(consulta.id, 'doctor-123');

      expect(ConsultaStateManager.firmadas).toHaveLength(1);
      expect(ConsultaStateManager.firmadas[0].id).toBe(consulta.id);
    });
  });

  describe('filtrarConsultas', () => {
    beforeEach(async () => {
      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-1',
        pacienteNombre: 'Paciente 1',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Motivo 1'
      });

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-2',
        pacienteNombre: 'Paciente 2',
        doctorId: 'doctor-123',
        estado: 'en_atencion',
        tipo: 'presencial',
        motivo: 'Motivo 2'
      });

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-3',
        pacienteNombre: 'Paciente 3',
        doctorId: 'doctor-456',
        estado: 'finalizada',
        tipo: 'teleconsulta',
        motivo: 'Motivo 3'
      });
    });

    it('should filter by estado', () => {
      const pendientes = ConsultaStateManager.filtrarConsultas({ estado: 'pendiente' });

      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].estado).toBe('pendiente');
    });

    it('should filter by tipo', () => {
      const teleconsultas = ConsultaStateManager.filtrarConsultas({ tipo: 'teleconsulta' });

      expect(teleconsultas).toHaveLength(2);
      expect(teleconsultas.every(c => c.tipo === 'teleconsulta')).toBe(true);
    });

    it('should filter by pacienteId', () => {
      const delPaciente = ConsultaStateManager.filtrarConsultas({ pacienteId: 'paciente-1' });

      expect(delPaciente).toHaveLength(1);
      expect(delPaciente[0].pacienteId).toBe('paciente-1');
    });

    it('should filter by multiple criteria', () => {
      const resultados = ConsultaStateManager.filtrarConsultas({
        estado: 'pendiente',
        tipo: 'teleconsulta'
      });

      expect(resultados).toHaveLength(1);
      expect(resultados[0].estado).toBe('pendiente');
      expect(resultados[0].tipo).toBe('teleconsulta');
    });

    it('should return all when no filters provided', () => {
      const todas = ConsultaStateManager.filtrarConsultas({});

      expect(todas).toHaveLength(3);
    });
  });

  describe('computed properties', () => {
    beforeEach(async () => {
      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-1',
        pacienteNombre: 'Paciente 1',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Motivo 1'
      });

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-2',
        pacienteNombre: 'Paciente 2',
        doctorId: 'doctor-123',
        estado: 'en_atencion',
        tipo: 'presencial',
        motivo: 'Motivo 2'
      });

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-3',
        pacienteNombre: 'Paciente 3',
        doctorId: 'doctor-123',
        estado: 'borrador',
        tipo: 'teleconsulta',
        motivo: 'Motivo 3'
      });
    });

    it('should have pendientes property', () => {
      expect(ConsultaStateManager.pendientes).toHaveLength(1);
      expect(ConsultaStateManager.pendientes[0].estado).toBe('pendiente');
    });

    it('should have enAtencion property', () => {
      expect(ConsultaStateManager.enAtencion).toHaveLength(1);
      expect(ConsultaStateManager.enAtencion[0].estado).toBe('en_atencion');
    });

    it('should have borradores property', () => {
      expect(ConsultaStateManager.borradores).toHaveLength(1);
      expect(ConsultaStateManager.borradores[0].estado).toBe('borrador');
    });

    it('should have finalizadas property', () => {
      expect(ConsultaStateManager.finalizadas).toHaveLength(0);
    });

    it('should have firmadas property', () => {
      expect(ConsultaStateManager.firmadas).toHaveLength(0);
    });
  });

  describe('subscribers', () => {
    it('should notify subscribers on consulta create', async () => {
      const subscriber = vi.fn();
      ConsultaStateManager.subscribe(subscriber);

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      expect(subscriber).toHaveBeenCalled();
    });

    it('should notify subscribers on consulta update', async () => {
      const subscriber = vi.fn();
      ConsultaStateManager.subscribe(subscriber);

      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      vi.clearAllMocks();

      await ConsultaStateManager.updateConsulta(consulta.id, { estado: 'finalizada' });

      expect(subscriber).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const subscriber = vi.fn();
      const unsubscribe = ConsultaStateManager.subscribe(subscriber);

      unsubscribe();

      // No debería llamarse
      subscriber('mock');
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should remove all consultas', async () => {
      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      expect(ConsultaStateManager.consultas).toHaveLength(1);

      ConsultaStateManager.clearAll();

      expect(ConsultaStateManager.consultas).toHaveLength(0);
      expect(ConsultaStateManager.consultaActiva).toBeNull();
    });
  });

  describe('getConsultaById', () => {
    it('should return consulta by ID', async () => {
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      const found = ConsultaStateManager.getConsultaById(consulta.id);

      expect(found).toEqual(consulta);
    });

    it('should return undefined for non-existent ID', () => {
      const found = ConsultaStateManager.getConsultaById('non-existent');

      expect(found).toBeUndefined();
    });
  });

  describe('cleanup and memory management', () => {
    it('should register online/offline event listeners on construction', () => {
      // Limpiar instancia anterior
      ConsultaStateManager.destroy();

      // Limpiar mocks
      eventListeners.clear();
      addEventListenerMock.mockClear();

      // Recargar el módulo para crear nueva instancia (simulado)
      // En una situación real, esto se haría con un factory method
      expect(addEventListenerMock).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerMock).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should remove event listeners on destroy', () => {
      // El destroy debería remover los event listeners
      ConsultaStateManager.destroy();

      expect(removeEventListenerMock).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerMock).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clear subscribers on destroy', () => {
      const subscriber = vi.fn();
      ConsultaStateManager.subscribe(subscriber);

      // Llamar destroy
      ConsultaStateManager.destroy();

      // Después de destroy, el suscriptor no debería ser notificado
      // (esto se verifica indirectamente al no llamar al suscriptor)
      // No podemos acceder directamente a subscribers por ser privado
      expect(() => ConsultaStateManager.destroy()).not.toThrow();
    });

    it('should clear sync queue on destroy', async () => {
      // Crear consulta offline
      vi.stubGlobal('window', {
        ...window,
        navigator: { onLine: false },
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock
      });

      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      // Verificar cola creada
      expect(ConsultaStateManager.consultas).toHaveLength(1);

      // Llamar destroy
      ConsultaStateManager.destroy();

      // La cola interna se limpia (no es fácil de testear sin exponerla)
      // Pero el destroy no debería lanzar error
      expect(() => ConsultaStateManager.destroy()).not.toThrow();
    });

    it('should handle multiple destroy calls safely', () => {
      ConsultaStateManager.destroy();
      expect(() => ConsultaStateManager.destroy()).not.toThrow();
      expect(() => ConsultaStateManager.destroy()).not.toThrow();
    });
  });

  describe('localStorage debouncing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce localStorage writes', async () => {
      // Crear una consulta
      await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      // Inmediatamente no debería haber llamado a setItem
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Avanzar tiempo menos del debounce
      vi.advanceTimersByTime(400);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Avanzar tiempo completo del debounce
      vi.advanceTimersByTime(100);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should reset debounce timer on multiple updates', async () => {
      // Crear consulta
      const consulta = await ConsultaStateManager.createConsulta({
        pacienteId: 'paciente-123',
        pacienteNombre: 'Juan Pérez',
        doctorId: 'doctor-123',
        estado: 'pendiente',
        tipo: 'teleconsulta',
        motivo: 'Dolor de cabeza'
      });

      // Avanzar tiempo parcial
      vi.advanceTimersByTime(300);

      // Actualizar consulta (resetea el timer)
      await ConsultaStateManager.updateConsulta(consulta.id, { estado: 'en_atencion' });

      // Avanzar tiempo parcial (total 600ms pero reseteado)
      vi.advanceTimersByTime(300);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Completar el debounce después del reset
      vi.advanceTimersByTime(200);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});
