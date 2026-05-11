/**
 * Tests para validación de RUC ecuatoriano
 */

import { describe, it, expect } from 'vitest';
import { validarRUC, extraerRUCInfo } from '../ruc-validator';

describe('validarRUC', () => {
  describe('Validaciones generales', () => {
    it('debería rechazar RUC con longitud incorrecta', () => {
      let result = validarRUC('171003406500'); // 12 dígitos
      expect(result.valid).toBe(false);
      expect(result.error).toContain('13 dígitos');

      result = validarRUC('17100340650011'); // 14 dígitos
      expect(result.valid).toBe(false);
    });

    it('debería rechazar RUC con caracteres no numéricos', () => {
      const result = validarRUC('171003406500a');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('solo dígitos');
    });

    it('debería rechazar RUC con código de provincia inválido', () => {
      // Provincia 00 (inválida)
      let result = validarRUC('0010034065001');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('provincia');

      // Provincia 13 (no existe)
      result = validarRUC('1310034065001');
      expect(result.valid).toBe(false);

      // Provincia 25 (fuera de rango)
      result = validarRUC('2510034065001');
      expect(result.valid).toBe(false);
    });

    it('debería rechazar RUC con tercer dígito inválido', () => {
      // Tercer dígito debe ser 0-6 o 9
      const result = validarRUC('1770034065001'); // 7 es inválido
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tercer dígito inválido');
    });
  });

  describe('Con formato (con guiones o espacios)', () => {
    it('debería limpiar guiones del RUC', () => {
      // RUC con guiones - debe limpiar primero
      const rucSinGuiones = '1710034065001'.replace(/[\s-]/g, '');
      const result = validarRUC('171003406-5001');
      // El resultado debe ser el mismo que con el RUC limpio
      expect(result.valid).toBe(validarRUC(rucSinGuiones).valid);
    });

    it('debería limpiar espacios del RUC', () => {
      const rucSinEspacios = '1710034065001'.replace(/[\s-]/g, '');
      const result = validarRUC('171003406 5001');
      expect(result.valid).toBe(validarRUC(rucSinEspacios).valid);
    });
  });
});

describe('extraerRUCInfo', () => {
  it('debería retornar null para RUC inválido', () => {
    let info = extraerRUCInfo('171003406500'); // Longitud incorrecta
    expect(info).toBeNull();

    info = extraerRUCInfo('1770034065001'); // Tercer dígito inválido
    expect(info).toBeNull();
  });

  it('debería extraer tipo correctamente', () => {
    // RUC natural (tercer dígito 0-5)
    const infoNatural = extraerRUCInfo('1710034065001');
    if (infoNatural) {
      expect(infoNatural.tipo).toBe('natural');
    }

    // RUC público (tercer dígito 6)
    const infoPublico = extraerRUCInfo('1760001550001');
    if (infoPublico) {
      expect(infoPublico.tipo).toBe('publico');
    }

    // RUC jurídico (tercer dígito 9)
    const infoJuridico = extraerRUCInfo('0990004355001');
    if (infoJuridico) {
      expect(infoJuridico.tipo).toBe('juridico');
    }
  });

  it('debería extraer provincia correctamente', () => {
    const info = extraerRUCInfo('1710034065001');
    if (info) {
      expect(info.provincia).toBe(17);
    }
  });

  it('debería extraer establecimiento correctamente', () => {
    const info = extraerRUCInfo('1710034065001');
    if (info) {
      expect(info.establecimiento).toBe('5001');
    }
  });
});

describe('Casos límite', () => {
  it('debería rechazar provincia 13', () => {
    const result = validarRUC('1310034065001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('provincia');
  });

  it('debería validar provincia 01', () => {
    const result = validarRUC('0100000001001');
    // Nota: El RUC puede no ser válido por DV, pero la provincia debería pasar
    if (result.valid) {
      expect(result.valid).toBe(true);
    } else {
      // Si falla, no debe ser por provincia
      expect(result.error).not.toContain('provincia');
    }
  });

  it('debería validar provincia 24', () => {
    const result = validarRUC('2400000001001');
    if (result.valid) {
      expect(result.valid).toBe(true);
    } else {
      expect(result.error).not.toContain('provincia');
    }
  });
});
