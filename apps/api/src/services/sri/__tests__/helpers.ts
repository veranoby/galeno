/**
 * Helper para generar RUCs válidos para testing
 */

// RUCs válidos reales para tests (ejemplos de documentación SRI)
export const RUCS_VALIDOS = {
  natural: '1710034065001',
  publico: '1760001550001',
  juridico: '0990004355001',
};

// RUCs inválidos para tests (último dígito modificado)
export const RUCS_INVALIDOS = {
  natural: '1710034065002', // Último dígito incorrecto
  publico: '1760001550002',  // Último dígito incorrecto
  juridico: '0990004355002',  // Último dígito incorrecto
};
