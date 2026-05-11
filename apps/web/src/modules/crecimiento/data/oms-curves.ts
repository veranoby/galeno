// apps/web/src/modules/crecimiento/data/oms-curves.ts

/**
 * Datos de curvas de crecimiento de la OMS (WHO Child Growth Standards)
 * Simplificado para demostración. En producción, usar los datos completos de la OMS.
 */

import type { OMSReferencia, Sexo, TipoMedicion } from '../types';

/**
 * Curva de Peso para la Edad - Niños
 */
export const PESO_EDAD_M: OMSReferencia = {
  sexo: 'masculino',
  tipo: 'peso_edad',
  p3: generatePesoData(2.5, 3.3, 4.5, 6.5, 8.5, 11.5, 14.5, 17.5),
  p15: generatePesoData(3.0, 3.9, 5.3, 7.5, 9.8, 13.2, 16.5, 19.8),
  p50: generatePesoData(3.3, 4.5, 6.0, 8.5, 11.0, 14.8, 18.3, 21.7),
  p85: generatePesoData(3.7, 5.1, 6.8, 9.6, 12.4, 16.5, 20.2, 23.8),
  p97: generatePesoData(4.0, 5.7, 7.6, 10.8, 13.9, 18.3, 22.3, 26.1),
};

/**
 * Curva de Peso para la Edad - Niñas
 */
export const PESO_EDAD_F: OMSReferencia = {
  sexo: 'femenino',
  tipo: 'peso_edad',
  p3: generatePesoData(2.4, 3.0, 4.2, 6.0, 7.8, 10.5, 13.5, 16.5),
  p15: generatePesoData(2.8, 3.6, 5.0, 7.0, 9.2, 12.3, 15.5, 18.8),
  p50: generatePesoData(3.2, 4.2, 5.8, 8.0, 10.5, 13.9, 17.3, 20.8),
  p85: generatePesoData(3.6, 4.8, 6.6, 9.1, 11.8, 15.6, 19.3, 23.0),
  p97: generatePesoData(3.9, 5.4, 7.5, 10.3, 13.3, 17.5, 21.5, 25.3),
};

/**
 * Curva de Talla para la Edad - Niños
 */
export const TALLA_EDAD_M: OMSReferencia = {
  sexo: 'masculino',
  tipo: 'talla_edad',
  p3: generateTallaData(45, 55, 65, 75, 85, 95, 102, 108),
  p15: generateTallaData(48, 58, 68, 78, 88, 98, 105, 112),
  p50: generateTallaData(50, 60, 70, 80, 90, 100, 108, 115),
  p85: generateTallaData(52, 62, 72, 82, 92, 102, 110, 118),
  p97: generateTallaData(54, 64, 74, 84, 94, 104, 112, 120),
};

/**
 * Curva de Talla para la Edad - Niñas
 */
export const TALLA_EDAD_F: OMSReferencia = {
  sexo: 'femenino',
  tipo: 'talla_edad',
  p3: generateTallaData(44, 54, 64, 74, 84, 93, 100, 107),
  p15: generateTallaData(47, 57, 67, 77, 87, 96, 103, 111),
  p50: generateTallaData(49, 59, 69, 79, 89, 98, 106, 113),
  p85: generateTallaData(51, 61, 71, 81, 91, 100, 108, 116),
  p97: generateTallaData(53, 63, 73, 83, 93, 102, 110, 118),
};

/**
 * Curva de Peso para la Talla - Niños
 */
export const PESO_TALLA_M: OMSReferencia = {
  sexo: 'masculino',
  tipo: 'peso_talla',
  p3: [2.9, 3.3, 3.8, 4.3, 4.9, 5.5, 6.2, 6.9, 7.7, 8.5, 9.4, 10.3, 11.2, 12.1],
  p15: [3.3, 3.8, 4.4, 5.0, 5.7, 6.4, 7.2, 8.0, 8.9, 9.8, 10.8, 11.8, 12.8, 13.8],
  p50: [3.8, 4.3, 5.0, 5.7, 6.5, 7.3, 8.2, 9.1, 10.1, 11.1, 12.2, 13.3, 14.4, 15.5],
  p85: [4.3, 4.9, 5.7, 6.5, 7.4, 8.3, 9.3, 10.3, 11.4, 12.5, 13.7, 14.9, 16.1, 17.2],
  p97: [4.8, 5.5, 6.4, 7.4, 8.4, 9.5, 10.6, 11.7, 12.9, 14.1, 15.4, 16.7, 18.0, 19.2],
};

/**
 * Curva de Peso para la Talla - Niñas
 */
export const PESO_TALLA_F: OMSReferencia = {
  sexo: 'femenino',
  tipo: 'peso_talla',
  p3: [2.7, 3.1, 3.6, 4.1, 4.7, 5.3, 6.0, 6.7, 7.5, 8.3, 9.1, 10.0, 10.9, 11.8],
  p15: [3.1, 3.6, 4.2, 4.8, 5.4, 6.1, 6.9, 7.7, 8.6, 9.5, 10.4, 11.4, 12.4, 13.4],
  p50: [3.5, 4.1, 4.8, 5.5, 6.2, 7.0, 7.9, 8.8, 9.8, 10.8, 11.8, 12.9, 14.0, 15.0],
  p85: [4.0, 4.7, 5.5, 6.3, 7.1, 8.0, 9.0, 10.0, 11.1, 12.2, 13.3, 14.5, 15.6, 16.7],
  p97: [4.5, 5.3, 6.2, 7.2, 8.1, 9.1, 10.2, 11.3, 12.5, 13.7, 14.9, 16.2, 17.4, 18.5],
};

/**
 * Curva de IMC para la Edad - Niños
 */
export const IMC_EDAD_M: OMSReferencia = {
  sexo: 'masculino',
  tipo: 'imc_edad',
  p3: generateIMCData(12.5, 14.5, 15.0, 15.0, 14.8, 14.5, 14.2, 14.0),
  p15: generateIMCData(13.5, 15.5, 16.0, 16.0, 15.8, 15.5, 15.2, 15.0),
  p50: generateIMCData(14.5, 16.5, 17.0, 17.0, 16.8, 16.5, 16.2, 16.0),
  p85: generateIMCData(15.5, 17.5, 18.0, 18.0, 17.8, 17.5, 17.2, 17.0),
  p97: generateIMCData(16.5, 18.5, 19.0, 19.0, 18.8, 18.5, 18.2, 18.0),
};

/**
 * Curva de IMC para la Edad - Niñas
 */
export const IMC_EDAD_F: OMSReferencia = {
  sexo: 'femenino',
  tipo: 'imc_edad',
  p3: generateIMCData(12.0, 14.2, 14.8, 14.9, 14.7, 14.4, 14.1, 13.9),
  p15: generateIMCData(13.0, 15.2, 15.8, 15.9, 15.7, 15.4, 15.1, 14.9),
  p50: generateIMCData(14.0, 16.2, 16.8, 16.9, 16.7, 16.4, 16.1, 15.9),
  p85: generateIMCData(15.0, 17.2, 17.8, 17.9, 17.7, 17.4, 17.1, 16.9),
  p97: generateIMCData(16.0, 18.2, 18.8, 18.9, 18.7, 18.4, 18.1, 17.9),
};

/**
 * Genera datos de peso interpolados (kg)
 * Valores aproximados para demostración
 */
function generatePesoData(
  mes0_6: number, mes6_12: number, mes12_24: number,
  mes24_36: number, mes36_48: number, mes48_60: number,
  mes60_72: number, mes72_plus: number
): number[] {
  const data: number[] = [];
  const points = [0, 6, 12, 24, 36, 48, 60, 72];
  const values = [mes0_6, mes6_12, mes12_24, mes24_36, mes36_48, mes48_60, mes60_72, mes72_plus];

  for (let mes = 0; mes <= 60; mes++) {
    // Encontrar el segmento correspondiente
    let i = 0;
    for (i = 0; i < points.length - 1; i++) {
      if (mes >= points[i] && mes <= points[i + 1]) {
        break;
      }
    }

    const p1 = points[i];
    const p2 = points[i + 1];
    const v1 = values[i];
    const v2 = values[i + 1];

    // Interpolación lineal
    const t = (mes - p1) / (p2 - p1);
    data.push(v1 + t * (v2 - v1));
  }

  return data;
}

/**
 * Genera datos de talla interpolados (cm)
 */
function generateTallaData(
  mes0_6: number, mes6_12: number, mes12_24: number,
  mes24_36: number, mes36_48: number, mes48_60: number,
  mes60_72: number, mes72_plus: number
): number[] {
  const data: number[] = [];
  const points = [0, 6, 12, 24, 36, 48, 60, 72];
  const values = [mes0_6, mes6_12, mes12_24, mes24_36, mes36_48, mes48_60, mes60_72, mes72_plus];

  for (let mes = 0; mes <= 60; mes++) {
    let i = 0;
    for (i = 0; i < points.length - 1; i++) {
      if (mes >= points[i] && mes <= points[i + 1]) {
        break;
      }
    }

    const p1 = points[i];
    const p2 = points[i + 1];
    const v1 = values[i];
    const v2 = values[i + 1];

    const t = (mes - p1) / (p2 - p1);
    data.push(v1 + t * (v2 - v1));
  }

  return data;
}

/**
 * Genera datos de IMC interpolados
 */
function generateIMCData(
  mes0_6: number, mes6_12: number, mes12_24: number,
  mes24_36: number, mes36_48: number, mes48_60: number,
  mes60_72: number, mes72_plus: number
): number[] {
  const data: number[] = [];
  const points = [0, 6, 12, 24, 36, 48, 60, 72];
  const values = [mes0_6, mes6_12, mes12_24, mes24_36, mes36_48, mes48_60, mes60_72, mes72_plus];

  for (let mes = 0; mes <= 60; mes++) {
    let i = 0;
    for (i = 0; i < points.length - 1; i++) {
      if (mes >= points[i] && mes <= points[i + 1]) {
        break;
      }
    }

    const p1 = points[i];
    const p2 = points[i + 1];
    const v1 = values[i];
    const v2 = values[i + 1];

    const t = (mes - p1) / (p2 - p1);
    data.push(v1 + t * (v2 - v1));
  }

  return data;
}

/**
 * Obtiene la curva de referencia según sexo y tipo
 */
export function getCurvaReferencia(sexo: Sexo, tipo: TipoMedicion): OMSReferencia | null {
  const key = `${tipo.toUpperCase()}_${sexo === 'masculino' ? 'M' : 'F'}`;

  switch (key) {
    case 'PESO_EDAD_M': return PESO_EDAD_M;
    case 'PESO_EDAD_F': return PESO_EDAD_F;
    case 'TALLA_EDAD_M': return TALLA_EDAD_M;
    case 'TALLA_EDAD_F': return TALLA_EDAD_F;
    case 'PESO_TALLA_M': return PESO_TALLA_M;
    case 'PESO_TALLA_F': return PESO_TALLA_F;
    case 'IMC_EDAD_M': return IMC_EDAD_M;
    case 'IMC_EDAD_F': return IMC_EDAD_F;
    default: return null;
  }
}

/**
 * Obtiene todos los percentiles en un punto específico
 */
export function getPercentilesEnMes(
  sexo: Sexo,
  tipo: TipoMedicion,
  mes: number
): Record<string, number> | null {
  const curva = getCurvaReferencia(sexo, tipo);
  if (!curva) return null;

  const index = Math.min(Math.max(Math.round(mes), 0), 60);
  return {
    p3: curva.p3[index],
    p15: curva.p15[index],
    p50: curva.p50[index],
    p85: curva.p85[index],
    p97: curva.p97[index],
  };
}

/**
 * Calcula el percentil aproximado para un valor dado
 */
export function calcularPercentil(
  sexo: Sexo,
  tipo: TipoMedicion,
  mes: number,
  valor: number
): string {
  const percentiles = getPercentilesEnMes(sexo, tipo, mes);
  if (!percentiles) return 'p50';

  if (valor <= percentiles.p3) return 'p3';
  if (valor <= percentiles.p15) return 'p15';
  if (valor <= percentiles.p50) return 'p50';
  if (valor <= percentiles.p85) return 'p85';
  return 'p97';
}
