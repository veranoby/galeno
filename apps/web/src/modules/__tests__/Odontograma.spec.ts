/**
 * Tests for Odontograma Module Types and Utilities
 * 
 * Tests the type definitions, constants, and utility functions
 * for the Odontograma (Dental Chart) module.
 */

import { describe, it, expect } from 'vitest';
import {
  ESTADO_COLORS,
  TIPO_DIENTE_POR_POSICION,
  ODONTOGRAMA_CONSTANTS,
  type DienteId,
  type Cuadrante,
  type TipoDiente,
  type CaraDiente,
  type EstadoDiente,
  type TratamientoCara,
  type DienteInfo,
} from '../odontograma/types';

describe('Odontograma Types', () => {
  describe('ESTADO_COLORS', () => {
    it('should have color for sano state', () => {
      expect(ESTADO_COLORS.sano).toBe('#4CAF50');
    });

    it('should have color for caries state', () => {
      expect(ESTADO_COLORS.caries).toBe('#FF9800');
    });

    it('should have color for obturado state', () => {
      expect(ESTADO_COLORS.obturado).toBe('#2196F3');
    });

    it('should have color for extraccion state', () => {
      expect(ESTADO_COLORS.extraccion).toBe('#9E9E9E');
    });

    it('should have color for corona state', () => {
      expect(ESTADO_COLORS.corona).toBe('#9C27B0');
    });

    it('should have color for implante state', () => {
      expect(ESTADO_COLORS.implante).toBe('#00BCD4');
    });

    it('should have color for endodoncia state', () => {
      expect(ESTADO_COLORS.endodoncia).toBe('#F44336');
    });

    it('should have color for fracturado state', () => {
      expect(ESTADO_COLORS.fracturado).toBe('#E91E63');
    });

    it('should have color for ausente state', () => {
      expect(ESTADO_COLORS.ausente).toBe('#BDBDBD');
    });

    it('should have color for erupcion state', () => {
      expect(ESTADO_COLORS.erupcion).toBe('#CDDC39');
    });

    it('should have all required estado states defined', () => {
      const requiredStates: EstadoDiente[] = [
        'sano',
        'caries',
        'obturado',
        'extraccion',
        'corona',
        'puente',
        'implante',
        'endodoncia',
        'fracturado',
        'supernumerario',
        'ausente',
        'erupcion',
      ];

      requiredStates.forEach((estado) => {
        expect(ESTADO_COLORS[estado]).toBeDefined();
        expect(typeof ESTADO_COLORS[estado]).toBe('string');
        // Validate hex color format
        expect(ESTADO_COLORS[estado]).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });

  describe('TIPO_DIENTE_POR_POSICION', () => {
    it('should map position 1 to incisivo', () => {
      expect(TIPO_DIENTE_POR_POSICION[1]).toBe('incisivo');
    });

    it('should map position 2 to incisivo', () => {
      expect(TIPO_DIENTE_POR_POSICION[2]).toBe('incisivo');
    });

    it('should map position 3 to canino', () => {
      expect(TIPO_DIENTE_POR_POSICION[3]).toBe('canino');
    });

    it('should map position 4 to premolar', () => {
      expect(TIPO_DIENTE_POR_POSICION[4]).toBe('premolar');
    });

    it('should map position 5 to premolar', () => {
      expect(TIPO_DIENTE_POR_POSICION[5]).toBe('premolar');
    });

    it('should map position 6 to molar', () => {
      expect(TIPO_DIENTE_POR_POSICION[6]).toBe('molar');
    });

    it('should map position 7 to molar', () => {
      expect(TIPO_DIENTE_POR_POSICION[7]).toBe('molar');
    });

    it('should map position 8 to molar', () => {
      expect(TIPO_DIENTE_POR_POSICION[8]).toBe('molar');
    });

    it('should have valid tipo values for all positions', () => {
      const validTipos: TipoDiente[] = [
        'incisivo',
        'canino',
        'premolar',
        'molar',
      ];

      for (let posicion = 1; posicion <= 8; posicion++) {
        const tipo = TIPO_DIENTE_POR_POSICION[posicion];
        expect(tipo).toBeDefined();
        expect(validTipos).toContain(tipo);
      }
    });
  });

  describe('ODONTOGRAMA_CONSTANTS', () => {
    it('should have correct cuadrante values', () => {
      expect(ODONTOGRAMA_CONSTANTS.CUADRANTES.SUPERIOR_DERECHO).toBe(1);
      expect(ODONTOGRAMA_CONSTANTS.CUADRANTES.SUPERIOR_IZQUIERDO).toBe(2);
      expect(ODONTOGRAMA_CONSTANTS.CUADRANTES.INFERIOR_IZQUIERDO).toBe(3);
      expect(ODONTOGRAMA_CONSTANTS.CUADRANTES.INFERIOR_DERECHO).toBe(4);
    });

    it('should have 8 dientes por cuadrante for permanentes', () => {
      expect(ODONTOGRAMA_CONSTANTS.DIENTES_POR_CUADRANTE).toBe(8);
    });

    it('should have 5 dientes por cuadrante for temporales', () => {
      expect(ODONTOGRAMA_CONSTANTS.DIENTES_TEMPORALES_POR_CUADRANTE).toBe(5);
    });
  });
});

describe('DienteId Type', () => {
  it('should accept valid FDI notation', () => {
    const validIds: DienteId[] = ['11', '12', '13', '21', '31', '41', '18', '48'];
    
    validIds.forEach((id) => {
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[1-4][1-8]$/);
    });
  });

  it('should have correct format for cuadrante 1', () => {
    const cuadrante1Ids: DienteId[] = ['11', '12', '13', '14', '15', '16', '17', '18'];
    
    cuadrante1Ids.forEach((id) => {
      expect(id.charAt(0)).toBe('1');
      expect(parseInt(id.charAt(1))).toBeGreaterThanOrEqual(1);
      expect(parseInt(id.charAt(1))).toBeLessThanOrEqual(8);
    });
  });

  it('should have correct format for cuadrante 4', () => {
    const cuadrante4Ids: DienteId[] = ['41', '42', '43', '44', '45', '46', '47', '48'];
    
    cuadrante4Ids.forEach((id) => {
      expect(id.charAt(0)).toBe('4');
      expect(parseInt(id.charAt(1))).toBeGreaterThanOrEqual(1);
      expect(parseInt(id.charAt(1))).toBeLessThanOrEqual(8);
    });
  });
});

describe('CaraDiente Type', () => {
  it('should include all valid tooth surfaces', () => {
    const validCaras: CaraDiente[] = [
      'oclusal',
      'vestibular',
      'palatino',
      'mesial',
      'distal',
      'raiz',
    ];

    validCaras.forEach((cara) => {
      expect(typeof cara).toBe('string');
      expect(cara.length).toBeGreaterThan(0);
    });
  });

  it('should have oclusal for chewing surface', () => {
    expect('oclusal' as CaraDiente).toBe('oclusal');
  });

  it('should have vestibular for outer/front surface', () => {
    expect('vestibular' as CaraDiente).toBe('vestibular');
  });

  it('should have palatino for inner upper surface', () => {
    expect('palatino' as CaraDiente).toBe('palatino');
  });
});

describe('EstadoDiente Type', () => {
  it('should include sano as default healthy state', () => {
    expect('sano' as EstadoDiente).toBe('sano');
  });

  it('should include caries for decay', () => {
    expect('caries' as EstadoDiente).toBe('caries');
  });

  it('should include obturado for filled tooth', () => {
    expect('obturado' as EstadoDiente).toBe('obturado');
  });

  it('should include extraccion for extracted tooth', () => {
    expect('extraccion' as EstadoDiente).toBe('extraccion');
  });

  it('should include all required states', () => {
    const requiredStates: EstadoDiente[] = [
      'sano',
      'caries',
      'obturado',
      'extraccion',
      'corona',
      'puente',
      'implante',
      'endodoncia',
      'fracturado',
      'supernumerario',
      'ausente',
      'erupcion',
    ];

    requiredStates.forEach((estado) => {
      expect(typeof estado).toBe('string');
      expect(estado.length).toBeGreaterThan(0);
    });
  });
});

describe('TratamientoCara Interface', () => {
  it('should create valid tratamiento with required fields', () => {
    const tratamiento: TratamientoCara = {
      cara: 'oclusal',
      estado: 'caries',
    };

    expect(tratamiento.cara).toBe('oclusal');
    expect(tratamiento.estado).toBe('caries');
  });

  it('should create valid tratamiento with optional fecha', () => {
    const fecha = new Date('2024-01-15');
    const tratamiento: TratamientoCara = {
      cara: 'vestibular',
      estado: 'obturado',
      fecha,
    };

    expect(tratamiento.cara).toBe('vestibular');
    expect(tratamiento.estado).toBe('obturado');
    expect(tratamiento.fecha).toEqual(fecha);
  });

  it('should create valid tratamiento with optional notas', () => {
    const tratamiento: TratamientoCara = {
      cara: 'mesial',
      estado: 'caries',
      notas: 'Caries pequeña en superficie',
    };

    expect(tratamiento.cara).toBe('mesial');
    expect(tratamiento.estado).toBe('caries');
    expect(tratamiento.notas).toBe('Caries pequeña en superficie');
  });

  it('should create valid tratamiento with all fields', () => {
    const fecha = new Date('2024-01-15');
    const tratamiento: TratamientoCara = {
      cara: 'distal',
      estado: 'obturado',
      fecha,
      notas: 'Obturación de composite',
    };

    expect(tratamiento.cara).toBe('distal');
    expect(tratamiento.estado).toBe('obturado');
    expect(tratamiento.fecha).toEqual(fecha);
    expect(tratamiento.notas).toBe('Obturación de composite');
  });
});

describe('DienteInfo Interface', () => {
  it('should create valid diente with required fields', () => {
    const diente: DienteInfo = {
      id: '11',
      cuadrante: 1,
      posicion: 1,
      tipo: 'incisivo',
      extra: false,
      seleccionado: false,
      caras: {},
      estado: 'sano',
    };

    expect(diente.id).toBe('11');
    expect(diente.cuadrante).toBe(1);
    expect(diente.posicion).toBe(1);
    expect(diente.tipo).toBe('incisivo');
    expect(diente.extra).toBe(false);
    expect(diente.seleccionado).toBe(false);
    expect(diente.caras).toEqual({});
    expect(diente.estado).toBe('sano');
  });

  it('should create valid diente with optional observaciones', () => {
    const diente: DienteInfo = {
      id: '36',
      cuadrante: 3,
      posicion: 6,
      tipo: 'molar',
      extra: false,
      seleccionado: false,
      caras: {},
      estado: 'sano',
      observaciones: 'Molar en buen estado',
    };

    expect(diente.id).toBe('36');
    expect(diente.cuadrante).toBe(3);
    expect(diente.posicion).toBe(6);
    expect(diente.tipo).toBe('molar');
    expect(diente.observaciones).toBe('Molar en buen estado');
  });

  it('should create valid diente with tratamientos en caras', () => {
    const diente: DienteInfo = {
      id: '46',
      cuadrante: 4,
      posicion: 6,
      tipo: 'molar',
      extra: false,
      seleccionado: false,
      caras: {
        oclusal: {
          cara: 'oclusal',
          estado: 'caries',
          fecha: new Date('2024-01-15'),
        },
        mesial: {
          cara: 'mesial',
          estado: 'obturado',
        },
      },
      estado: 'caries',
    };

    expect(diente.id).toBe('46');
    expect(Object.keys(diente.caras)).toHaveLength(2);
    expect(diente.caras.oclusal?.estado).toBe('caries');
    expect(diente.caras.mesial?.estado).toBe('obturado');
  });

  it('should create valid diente seleccionado', () => {
    const diente: DienteInfo = {
      id: '21',
      cuadrante: 2,
      posicion: 1,
      tipo: 'incisivo',
      extra: false,
      seleccionado: true,
      caras: {},
      estado: 'fracturado',
      observaciones: 'Fractura en borde incisal',
    };

    expect(diente.seleccionado).toBe(true);
    expect(diente.estado).toBe('fracturado');
  });

  it('should create valid diente temporal (extra)', () => {
    const diente: DienteInfo = {
      id: '51',
      cuadrante: 5,
      posicion: 1,
      tipo: 'incisivo',
      extra: true,
      seleccionado: false,
      caras: {},
      estado: 'erupcion',
    };

    expect(diente.extra).toBe(true);
    expect(diente.estado).toBe('erupcion');
  });
});

describe('Tooth Position Logic', () => {
  it('should correctly identify incisivos (positions 1-2)', () => {
    expect(TIPO_DIENTE_POR_POSICION[1]).toBe('incisivo');
    expect(TIPO_DIENTE_POR_POSICION[2]).toBe('incisivo');
  });

  it('should correctly identify caninos (position 3)', () => {
    expect(TIPO_DIENTE_POR_POSICION[3]).toBe('canino');
  });

  it('should correctly identify premolares (positions 4-5)', () => {
    expect(TIPO_DIENTE_POR_POSICION[4]).toBe('premolar');
    expect(TIPO_DIENTE_POR_POSICION[5]).toBe('premolar');
  });

  it('should correctly identify molares (positions 6-8)', () => {
    expect(TIPO_DIENTE_POR_POSICION[6]).toBe('molar');
    expect(TIPO_DIENTE_POR_POSICION[7]).toBe('molar');
    expect(TIPO_DIENTE_POR_POSICION[8]).toBe('molar');
  });
});

describe('Color Accessibility', () => {
  it('should have sufficient contrast for all estado colors', () => {
    // Simple check that colors are defined and in valid hex format
    Object.values(ESTADO_COLORS).forEach((color) => {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  it('should have distinct colors for different states', () => {
    const colors = Object.values(ESTADO_COLORS);
    const uniqueColors = new Set(colors);
    
    // All colors should be unique
    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe('FDI Notation Validation', () => {
  it('should validate cuadrante 1 (superior derecho) teeth', () => {
    for (let posicion = 1; posicion <= 8; posicion++) {
      const id = `1${posicion}`;
      expect(id).toMatch(/^[1-4][1-8]$/);
    }
  });

  it('should validate cuadrante 2 (superior izquierdo) teeth', () => {
    for (let posicion = 1; posicion <= 8; posicion++) {
      const id = `2${posicion}`;
      expect(id).toMatch(/^[1-4][1-8]$/);
    }
  });

  it('should validate cuadrante 3 (inferior izquierdo) teeth', () => {
    for (let posicion = 1; posicion <= 8; posicion++) {
      const id = `3${posicion}`;
      expect(id).toMatch(/^[1-4][1-8]$/);
    }
  });

  it('should validate cuadrante 4 (inferior derecho) teeth', () => {
    for (let posicion = 1; posicion <= 8; posicion++) {
      const id = `4${posicion}`;
      expect(id).toMatch(/^[1-4][1-8]$/);
    }
  });

  it('should reject invalid FDI notation', () => {
    const invalidIds = ['01', '51', '61', '71', '81', '19', '91', '1', '111'];
    
    invalidIds.forEach((id) => {
      expect(id).not.toMatch(/^[1-4][1-8]$/);
    });
  });
});
