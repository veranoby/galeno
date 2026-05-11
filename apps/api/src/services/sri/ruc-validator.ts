/**
 * Validación de RUC (Registro Único de Contribuyentes) Ecuador
 * Implementa algoritmo de módulo 11 según especificaciones SRI
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida un RUC ecuatoriano
 * @param ruc - RUC a validar (13 dígitos)
 * @returns ValidationResult con estado de validación
 */
export function validarRUC(ruc: string): ValidationResult {
  // Eliminar espacios y guiones
  const rucLimpio = ruc.replace(/[\s-]/g,  '');

  // Verificar longitud
  if (rucLimpio.length !== 13) {
    return { valid: false, error: 'El RUC debe tener 13 dígitos' };
  }

  // Verificar que sean todos dígitos
  if (!/^\d+$/.test(rucLimpio)) {
    return { valid: false, error: 'El RUC debe contener solo dígitos' };
  }

  // Extraer componentes
  const provincia = parseInt(rucLimpio.substring(0,  2), 10);
  const tercerDigito = parseInt(rucLimpio[2],  10);

  // Validar provincia (01-24,  excepto 13)
  if (provincia < 1 || provincia > 24 || provincia === 13) {
    return { valid: false, error: 'Código de provincia inválido' };
  }

  // Validar según tipo de RUC
  if (tercerDigito >= 0 && tercerDigito <= 5) {
    // RUC de persona natural (se valida como cédula en los primeros 10 dígitos)
    return validarRUCNatural(rucLimpio);
  } else if (tercerDigito === 6) {
    // RUC público
    return validarRUCPublico(rucLimpio);
  } else if (tercerDigito === 9) {
    // RUC jurídico
    return validarRUCJuridico(rucLimpio);
  } else {
    return { valid: false, error: 'Tercer dígito inválido' };
  }
}

/**
 * Valida RUC de persona natural (mismo algoritmo que cédula)
 */
function validarRUCNatural(ruc: string): ValidationResult {
  // Validar dígito verificador en posición 10
  const digitoVerificador = parseInt(ruc[9],  10);
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let producto = parseInt(ruc[i],  10) * coeficientes[i];
    if (producto >= 10) {
      producto -= 9;
    }
    suma += producto;
  }

  const resto = suma % 10;
  const digitoCalculado = resto === 0 ? 0 : 10 - resto;

  if (digitoCalculado !== digitoVerificador) {
    return { valid: false, error: 'Dígito verificador inválido (persona natural)' };
  }

  return { valid: true };
}

/**
 * Valida RUC de entidad pública
 */
function validarRUCPublico(ruc: string): ValidationResult {
  const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;

  for (let i = 0; i < 8; i++) {
    suma += parseInt(ruc[i],  10) * coeficientes[i];
  }

  const resto = suma % 11;
  const digitoCalculado = resto === 0 ? 0 : 11 - resto;
  const digitoVerificador = parseInt(ruc[8],  10);

  if (digitoCalculado !== digitoVerificador) {
    return { valid: false, error: 'Dígito verificador inválido (entidad pública)' };
  }

  // Establecimiento debe tener al menos un dígito distinto de cero
  const establecimiento = parseInt(ruc.substring(9,  13), 10);
  if (establecimiento === 0) {
    return { valid: false, error: 'Establecimiento inválido' };
  }

  return { valid: true };
}

/**
 * Valida RUC de persona jurídica
 */
function validarRUCJuridico(ruc: string): ValidationResult {
  const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    suma += parseInt(ruc[i],  10) * coeficientes[i];
  }

  const resto = suma % 11;
  const digitoCalculado = resto === 0 ? 0 : 11 - resto;
  const digitoVerificador = parseInt(ruc[9],  10);

  if (digitoCalculado !== digitoVerificador) {
    return { valid: false, error: 'Dígito verificador inválido (persona jurídica)' };
  }

  // Establecimiento debe tener al menos un dígito distinto de cero
  const establecimiento = parseInt(ruc.substring(9,  13), 10);
  if (establecimiento === 0) {
    return { valid: false, error: 'Establecimiento inválido' };
  }

  return { valid: true };
}

/**
 * Extrae información del RUC
 */
export interface RUCInfo {
  tipo: 'natural' | 'publico' | 'juridico';
  provincia: number;
  establecimiento: string;
}

export function extraerRUCInfo(ruc: string): RUCInfo | null {
  const rucLimpio = ruc.replace(/[\s-]/g,  '');

  if (rucLimpio.length !== 13) return null;

  const tercerDigito = parseInt(rucLimpio[2],  10);
  const provincia = parseInt(rucLimpio.substring(0,  2), 10);
  const establecimiento = rucLimpio.substring(9,  13);

  let tipo: RUCInfo['tipo'];

  if (tercerDigito >= 0 && tercerDigito <= 5) {
    tipo = 'natural';
  } else if (tercerDigito === 6) {
    tipo = 'publico';
  } else if (tercerDigito === 9) {
    tipo = 'juridico';
  } else {
    return null;
  }

  return { tipo, provincia, establecimiento };
}
