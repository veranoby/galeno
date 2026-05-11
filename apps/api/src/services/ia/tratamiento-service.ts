// apps/api/src/services/ia/tratamiento-service.ts
import { geminiService } from './gemini-client.js';

export async function sugerirTratamiento(
  userId: string,
  diagnostico: string, 
  evolucion: string
): Promise<{ 
  medicamentos: { nombre: string; dosis: string; tipo: string }[]; 
  examenes: { nombre: string; urgencia: string }[]; 
  alertas: { mensaje: string; tipo: string }[] 
}> {
  try {
    return await geminiService.sugerirTratamiento(userId,  diagnostico,  evolucion);
  } catch (error) {
    console.error('Error sugiriendo tratamiento:', error);
    throw new Error('No se pudo sugerir el tratamiento');
  }
}
