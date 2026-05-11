// apps/api/src/services/ia/diagnostico-service.ts
import { geminiService } from './gemini-client.js';
import { ConsultaContext } from '../../types/ia.types.js';

export async function generarDiagnosticoCIE10(
  userId: string,
  evolucion: string, 
  contexto: ConsultaContext
): Promise<{ codigo: string; descripcion: string; confianza: number }[]> {
  try {
    return await geminiService.diagnosticarCIE10(userId,  evolucion,  contexto);
  } catch (error) {
    console.error('Error generando diagnóstico CIE-10:', error);
    throw new Error('No se pudo generar el diagnóstico CIE-10');
  }
}
