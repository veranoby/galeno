import { EstadoConsulta } from '@prisma/client';

/**
 * Máquina de Estados para Consultas
 * Define las transiciones válidas entre estados de consulta
 */

// Mapa de transiciones válidas: desde -> hacia permitidos
const VALID_TRANSITIONS: Record<EstadoConsulta, EstadoConsulta[]> = {
  borrador: ['triaje', 'finalizada'],
  triaje: ['pendiente'],
  pendiente: ['en_atencion'],
  en_atencion: ['finalizada', 'interconsulta'],
  finalizada: [], // Estado terminal - sin transiciones salientes
  interconsulta: ['pendiente', 'finalizada']
};

// Mapa inverso: hacia -> desde permitidos (para validación)
const REVERSE_TRANSITIONS: Record<EstadoConsulta, EstadoConsulta[]> = {
  borrador: [],
  triaje: ['borrador'],
  pendiente: ['triaje', 'interconsulta'],
  en_atencion: ['pendiente'],
  finalizada: ['borrador', 'en_atencion', 'interconsulta'],
  interconsulta: ['en_atencion']
};

/**
 * Verifica si una transición entre estados es válida
 * @param from Estado actual
 * @param to Estado destino
 * @returns true si la transición es válida
 */
export function canTransition(from: EstadoConsulta, to: EstadoConsulta): boolean {
  if (from === to) {
    return false; // No permitir transiciones al mismo estado
  }

  const allowedStates = VALID_TRANSITIONS[from];
  return allowedStates.includes(to);
}

/**
 * Obtiene los próximos estados posibles desde un estado actual
 * @param current Estado actual
 * @returns Array de estados posibles
 */
export function getNextStates(current: EstadoConsulta): EstadoConsulta[] {
  return [...VALID_TRANSITIONS[current]];
}

/**
 * Valida una transición y lanza error si no es válida
 * @param from Estado actual
 * @param to Estado destino
 * @throws Error si la transición no es válida
 */
export function validateTransition(from: EstadoConsulta, to: EstadoConsulta): void {
  if (!canTransition(from, to)) {
    const validStates = getNextStates(from);
    throw new Error(
      `Transición inválida: ${from} -> ${to}. ` +
      `Estados permitidos desde ${from}: ${validStates.join(', ') || 'ninguno (estado terminal)'}`
    );
  }
}

/**
 * Verifica si un estado es terminal (no tiene transiciones salientes)
 * @param state Estado a verificar
 * @returns true si es un estado terminal
 */
export function isTerminalState(state: EstadoConsulta): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}

/**
 * Obtiene información de la máquina de estados para un estado
 * @param current Estado actual
 * @returns Objeto con información del estado
 */
export function getStateInfo(current: EstadoConsulta) {
  return {
    current,
    nextStates: getNextStates(current),
    isTerminal: isTerminalState(current),
    canTransitionTo: (to: EstadoConsulta) => canTransition(current, to)
  };
}

/**
 * Obtiene todos los estados posibles en orden de flujo
 * @returns Array de estados en orden de flujo típico
 */
export function getAllStatesOrdered(): EstadoConsulta[] {
  return ['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta'];
}

/**
 * Obtiene el estado inicial predeterminado para una consulta
 * @returns Estado inicial
 */
export function getInitialState(): EstadoConsulta {
  return 'borrador';
}
