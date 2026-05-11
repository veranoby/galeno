// apps/api/src/services/ia/gemini-client.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import crypto from 'node:crypto';
import { 
  AntecedentePaciente, 
  Medicamento, 
  MedicamentoSugerido, 
  ExamenSugerido, 
  AlertaSugerida 
} from '../../types/ia.types';
import { iaQuotaService } from './quota.service.js';
import { logger } from '../../utils/logger.js';

export interface ConsultaContext {
  pacienteId: string;
  antecedentes: AntecedentePaciente[];
  medicamentosActivos: Medicamento[];
  alergias: string[];
}

export interface CodigoCIE10 {
  codigo: string;
  descripcion: string;
  confianza: number; // 0-1
}

export interface TratamientoSugerido {
  medicamentos: MedicamentoSugerido[];   // Chips verdes
  examenes: ExamenSugerido[];            // Chips amarillos
  alertas: AlertaSugerida[];             // Chips rojos
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private modelDiagnostico: GenerativeModel;
  private modelTratamiento: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

    this.genAI = new GoogleGenerativeAI(apiKey);

    // Modelo para diagnóstico CIE-10
    this.modelDiagnostico = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', 
      generationConfig: {
        temperature: 0.3,       // Bajo para consistencia
        maxOutputTokens: 500, 
        topP: 0.8, 
        topK: 40
      }
    });

    // Modelo para tratamiento
    this.modelTratamiento = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', 
      generationConfig: {
        temperature: 0.4, 
        maxOutputTokens: 800, 
        topP: 0.8, 
        topK: 40
      }
    });
  }

  private generateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async diagnosticarCIE10(
    userId: string,
    evolucion: string, 
    contexto: ConsultaContext
  ): Promise<CodigoCIE10[]> {
    const systemPrompt = `Eres un asistente médico experto en codificación CIE-10.
Analiza la evolución clínica y genera hasta 3 códigos CIE-10 probables.
Responde SOLO en formato JSON: [{"codigo": "A09", "descripcion": "...", "confianza": 0.85}]`;

    const antecedentesText = contexto.antecedentes
      .map(a => `- ${a.tipo}: ${a.detalle || a.descripcion || ''}`)
      .join('\n');

    const medicamentosText = contexto.medicamentosActivos
      .map(m => `- ${m.nombre}`)
      .join('\n');

    const alergiasText = contexto.alergias.length > 0
      ? contexto.alergias.join(',  ')
      : 'Ninguna';

    const prompt = `Evolución: ${evolucion}
Antecedentes relevantes:
${antecedentesText}
Medicamentos activos:
${medicamentosText}
Alergias: ${alergiasText}
Genera códigos CIE-10 (máximo 3,  ordenados por probabilidad):`;

    const fullPrompt = systemPrompt + prompt;
    const promptHash = this.generateHash(fullPrompt);

    // 1. Intentar obtener de caché
    const cached = await iaQuotaService.getCachedPrompt(promptHash);
    if (cached) {
      return JSON.parse(cached.result);
    }

    // 2. Verificar cuota
    const quota = await iaQuotaService.checkQuota(userId);
    if (!quota.available) {
      throw new Error('QUOTA_EXCEEDED');
    }

    try {
      const result = await this.modelDiagnostico.generateContent(fullPrompt);
      const response = result.response.text();
      const parsed = this.parseCIE10JSON(response);

      if (parsed.length > 0) {
        // 3. Consumir cuota y cachear si hubo éxito
        await Promise.all([
          iaQuotaService.consumeQuota(userId),
          iaQuotaService.cachePrompt(promptHash, JSON.stringify(parsed))
        ]);
      }

      return parsed;
    } catch (error) {
      logger.error({
        event: 'gemini_diagnosis_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async sugerirTratamiento(
    userId: string,
    diagnostico: string, 
    evolucion: string
  ): Promise<TratamientoSugerido> {
    const systemPrompt = `Eres un asistente médico experto.
Sugiere tratamiento basado en diagnóstico CIE-10.
Responde SOLO en formato JSON con estructura:
{
  "medicamentos": [{"nombre": "...", "dosis": "...", "tipo": "generico"}],
  "examenes": [{"nombre": "...", "urgencia": "alta|media|baja"}],
  "alertas": [{"mensaje": "...", "tipo": "contraindicacion|precaucion"}]
}`;

    const prompt = `
Diagnóstico: ${diagnostico}
Evolución: ${evolucion}
Sugerir tratamiento:
`;

    const fullPrompt = systemPrompt + prompt;
    const promptHash = this.generateHash(fullPrompt);

    // 1. Intentar obtener de caché
    const cached = await iaQuotaService.getCachedPrompt(promptHash);
    if (cached) {
      return JSON.parse(cached.result);
    }

    // 2. Verificar cuota
    const quota = await iaQuotaService.checkQuota(userId);
    if (!quota.available) {
      throw new Error('QUOTA_EXCEEDED');
    }

    try {
      const result = await this.modelTratamiento.generateContent(fullPrompt);
      const response = result.response.text();
      const parsed = this.parseTratamientoJSON(response);

      // 3. Consumir cuota y cachear
      await Promise.all([
        iaQuotaService.consumeQuota(userId),
        iaQuotaService.cachePrompt(promptHash, JSON.stringify(parsed))
      ]);

      return parsed;
    } catch (error) {
      logger.error({
        event: 'gemini_treatment_error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { medicamentos: [], examenes: [], alertas: [] };
    }
  }

  private parseCIE10JSON(text: string): CodigoCIE10[] {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  private parseTratamientoJSON(text: string): TratamientoSugerido {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { medicamentos: [], examenes: [], alertas: [] };

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { medicamentos: [], examenes: [], alertas: [] };
    }
  }
}

export const geminiService = new GeminiService();
