import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateExpirationDate,
  calculateExpirationStatus,
  isDocumentExpired,
  getExpirationColor,
  getExpirationColorByDocument,
  formatExpirationStatus,
  DOCUMENT_EXPIRATION_DAYS,
  type ExpirationStatus,
} from '@/utils/documentExpiration';
import { TipoDocumento, EstadoDocumento } from '@galeno/shared-types';

describe('documentExpiration', () => {
  // Fecha fija para tests: 1 de febrero de 2026
  const fixedDate = new Date('2026-02-01T00:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DOCUMENT_EXPIRATION_DAYS', () => {
    it('defines correct expiration days for each document type', () => {
      expect(DOCUMENT_EXPIRATION_DAYS[TipoDocumento.RECETA]).toBe(30);
      expect(DOCUMENT_EXPIRATION_DAYS[TipoDocumento.EXAMEN]).toBe(90);
      expect(DOCUMENT_EXPIRATION_DAYS[TipoDocumento.CERTIFICADO]).toBe(null);
    });
  });

  describe('calculateExpirationDate', () => {
    it('calculates expiration date for RECETA (30 days)', () => {
      const fechaEmision = new Date('2026-01-01');
      const result = calculateExpirationDate(TipoDocumento.RECETA, fechaEmision);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.toDateString()).toBe(new Date('2026-01-31').toDateString());
    });

    it('calculates expiration date for EXAMEN (90 days)', () => {
      const fechaEmision = new Date('2026-01-01');
      const result = calculateExpirationDate(TipoDocumento.EXAMEN, fechaEmision);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.toDateString()).toBe(new Date('2026-04-01').toDateString());
    });

    it('returns null for CERTIFICADO (no expiration)', () => {
      const fechaEmision = new Date('2026-01-01');
      const result = calculateExpirationDate(TipoDocumento.CERTIFICADO, fechaEmision);
      
      expect(result).toBe(null);
    });

    it('accepts string date as input', () => {
      const fechaEmision = '2026-01-01T00:00:00.000Z';
      const result = calculateExpirationDate(TipoDocumento.RECETA, fechaEmision);
      
      expect(result?.toDateString()).toBe(new Date('2026-01-31').toDateString());
    });

    it('throws error for invalid date', () => {
      const invalidDate = 'invalid-date';
      
      expect(() => {
        calculateExpirationDate(TipoDocumento.RECETA, invalidDate);
      }).toThrow('Fecha de emisión inválida');
    });
  });

  describe('calculateExpirationStatus', () => {
    it('returns expired status for RECETA older than 30 days', () => {
      // Fecha de emisión: 1 de diciembre de 2025 (más de 30 días antes del 1 de febrero de 2026)
      const fechaEmision = new Date('2025-12-01');
      const result = calculateExpirationStatus(TipoDocumento.RECETA, fechaEmision, fixedDate);
      
      expect(result.isExpired).toBe(true);
      expect(result.hasExpiration).toBe(true);
      expect(result.estado).toBe(EstadoDocumento.CADUCADO);
      expect(result.daysRemaining).toBeLessThan(0);
      expect(result.expirationDate).toBeInstanceOf(Date);
      expect(result.statusText).toMatch(/Caducó hace \d+ días?/);
    });

    it('returns valid status for RECETA within 30 days', () => {
      // Fecha de emisión: 15 de enero de 2026 (16 días antes del 1 de febrero de 2026)
      const fechaEmision = new Date('2026-01-15');
      const result = calculateExpirationStatus(TipoDocumento.RECETA, fechaEmision, fixedDate);
      
      expect(result.isExpired).toBe(false);
      expect(result.hasExpiration).toBe(true);
      expect(result.estado).toBe(EstadoDocumento.ACTIVO);
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.statusText).toMatch(/\d+ días? restantes?/);
    });

    it('returns valid status for EXAMEN within 90 days', () => {
      // Fecha de emisión: 1 de noviembre de 2025 (92 días antes, pero examen dura 90 días)
      const fechaEmision = new Date('2025-11-15');
      const result = calculateExpirationStatus(TipoDocumento.EXAMEN, fechaEmision, fixedDate);
      
      expect(result.isExpired).toBe(false);
      expect(result.estado).toBe(EstadoDocumento.ACTIVO);
    });

    it('returns no expiration for CERTIFICADO', () => {
      const fechaEmision = new Date('2025-01-01');
      const result = calculateExpirationStatus(TipoDocumento.CERTIFICADO, fechaEmision, fixedDate);
      
      expect(result.isExpired).toBe(false);
      expect(result.hasExpiration).toBe(false);
      expect(result.daysRemaining).toBe(null);
      expect(result.expirationDate).toBe(null);
      expect(result.estado).toBe(EstadoDocumento.ACTIVO);
      expect(result.statusText).toBe('No caduca');
    });

    it('returns "Caduca hoy" when expiration date is today', () => {
      // Fecha de emisión: 2 de enero de 2026 (exactamente 30 días antes del 1 de febrero de 2026)
      const fechaEmision = new Date('2026-01-02');
      const result = calculateExpirationStatus(TipoDocumento.RECETA, fechaEmision, fixedDate);
      
      expect(result.daysRemaining).toBe(0);
      expect(result.statusText).toBe('Caduca hoy');
    });

    it('handles singular "día" vs plural "días" correctly', () => {
      // 1 día restante
      const fechaEmisionReceta = new Date('2026-01-03'); // 29 días después = 1 de febrero
      const resultReceta = calculateExpirationStatus(TipoDocumento.RECETA, fechaEmisionReceta, fixedDate);
      expect(resultReceta.statusText).toContain('día restante');

      // 1 día caducado
      const fechaEmisionCaducado = new Date('2025-12-31'); // 30 días después = 30 de enero (2 días antes)
      const resultCaducado = calculateExpirationStatus(TipoDocumento.RECETA, fechaEmisionCaducado, fixedDate);
      expect(resultCaducado.statusText).toContain('día');
    });
  });

  describe('isDocumentExpired', () => {
    it('returns true for expired document', () => {
      const fechaEmision = new Date('2025-12-01');
      expect(isDocumentExpired(TipoDocumento.RECETA, fechaEmision, fixedDate)).toBe(true);
    });

    it('returns false for valid document', () => {
      const fechaEmision = new Date('2026-01-15');
      expect(isDocumentExpired(TipoDocumento.RECETA, fechaEmision, fixedDate)).toBe(false);
    });

    it('returns false for CERTIFICADO (never expires)', () => {
      const fechaEmision = new Date('2020-01-01');
      expect(isDocumentExpired(TipoDocumento.CERTIFICADO, fechaEmision, fixedDate)).toBe(false);
    });

    it('uses current date when fechaReferencia is not provided', () => {
      vi.useRealTimers();
      vi.setSystemTime(new Date('2099-12-31'));
      
      const fechaEmision = new Date('2026-01-01');
      expect(isDocumentExpired(TipoDocumento.RECETA, fechaEmision)).toBe(true);
    });
  });

  describe('getExpirationColor', () => {
    it('returns red for expired document', () => {
      const status: ExpirationStatus = {
        isExpired: true,
        hasExpiration: true,
        daysRemaining: -10,
        expirationDate: new Date(),
        estado: EstadoDocumento.CADUCADO,
        statusText: 'Caducó hace 10 días',
      };
      
      expect(getExpirationColor(status)).toBe('#F44336');
    });

    it('returns green for valid document', () => {
      const status: ExpirationStatus = {
        isExpired: false,
        hasExpiration: true,
        daysRemaining: 10,
        expirationDate: new Date(),
        estado: EstadoDocumento.ACTIVO,
        statusText: '10 días restantes',
      };
      
      expect(getExpirationColor(status)).toBe('#4CAF50');
    });

    it('returns blue for document without expiration', () => {
      const status: ExpirationStatus = {
        isExpired: false,
        hasExpiration: false,
        daysRemaining: null,
        expirationDate: null,
        estado: EstadoDocumento.ACTIVO,
        statusText: 'No caduca',
      };
      
      expect(getExpirationColor(status)).toBe('#2196F3');
    });
  });

  describe('getExpirationColorByDocument', () => {
    it('returns correct color based on document type and date', () => {
      const expiredDate = new Date('2025-12-01');
      const validDate = new Date('2026-01-15');
      const certificadoDate = new Date('2020-01-01');

      expect(getExpirationColorByDocument(TipoDocumento.RECETA, expiredDate, fixedDate)).toBe('#F44336');
      expect(getExpirationColorByDocument(TipoDocumento.RECETA, validDate, fixedDate)).toBe('#4CAF50');
      expect(getExpirationColorByDocument(TipoDocumento.CERTIFICADO, certificadoDate, fixedDate)).toBe('#2196F3');
    });
  });

  describe('formatExpirationStatus', () => {
    it('returns correct format for expired document', () => {
      const status: ExpirationStatus = {
        isExpired: true,
        hasExpiration: true,
        daysRemaining: -10,
        expirationDate: new Date(),
        estado: EstadoDocumento.CADUCADO,
        statusText: 'Caducó hace 10 días',
      };

      const result = formatExpirationStatus(status);
      
      expect(result.text).toBe('Caducó hace 10 días');
      expect(result.color).toBe('#F44336');
      expect(result.icon).toBe('mdi-alert-circle');
    });

    it('returns correct format for valid document', () => {
      const status: ExpirationStatus = {
        isExpired: false,
        hasExpiration: true,
        daysRemaining: 15,
        expirationDate: new Date(),
        estado: EstadoDocumento.ACTIVO,
        statusText: '15 días restantes',
      };

      const result = formatExpirationStatus(status);
      
      expect(result.text).toBe('15 días restantes');
      expect(result.color).toBe('#4CAF50');
      expect(result.icon).toBe('mdi-check-circle');
    });

    it('returns correct format for document without expiration', () => {
      const status: ExpirationStatus = {
        isExpired: false,
        hasExpiration: false,
        daysRemaining: null,
        expirationDate: null,
        estado: EstadoDocumento.ACTIVO,
        statusText: 'No caduca',
      };

      const result = formatExpirationStatus(status);
      
      expect(result.text).toBe('No caduca');
      expect(result.color).toBe('#2196F3');
      expect(result.icon).toBe('mdi-lock-outline');
    });
  });

  describe('Edge Cases', () => {
    it('handles leap year correctly', () => {
      // 2024 es año bisiesto
      const fechaEmision = new Date('2024-01-01');
      const result = calculateExpirationDate(TipoDocumento.EXAMEN, fechaEmision);
      
      // 90 días desde el 1 de enero de 2024
      expect(result?.toDateString()).toBe(new Date('2024-03-31').toDateString());
    });

    it('handles month boundary correctly', () => {
      // 30 días desde el 15 de enero
      const fechaEmision = new Date('2026-01-15');
      const result = calculateExpirationDate(TipoDocumento.RECETA, fechaEmision);
      
      expect(result?.toDateString()).toBe(new Date('2026-02-14').toDateString());
    });

    it('handles year boundary correctly', () => {
      // 30 días desde el 15 de diciembre de 2025
      const fechaEmision = new Date('2025-12-15');
      const result = calculateExpirationDate(TipoDocumento.RECETA, fechaEmision);
      
      expect(result?.toDateString()).toBe(new Date('2026-01-14').toDateString());
    });
  });
});
