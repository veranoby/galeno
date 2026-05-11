// apps/api/src/services/migration/ai-structurer.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

/**
 * AI Structurer Service - Gemini 1.5 Flash
 * 
 * Mapea CSVs heterogéneos a modelos de Galeno usando IA
 * Soporta: CSV, JSON, Excel
 * 
 * Features:
 * - Detección automática de columnas
 * - Mapeo inteligente a modelos Prisma
 * - Validación de datos
 * - Soporte para grandes volúmenes (>10k rows)
 */

export interface RawDataRow {
  [key: string]: string | number | null;
}

export interface MappedDataRow {
  [key: string]: any;
  confidence: number;
  warnings: string[];
}

export interface MappingResult {
  sourceColumns: string[];
  targetModel: string;
  mappings: ColumnMapping[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  transformation?: string;
}

export interface StructuringJob {
  id: string;
  fileUrl: string;
  fileType: 'csv' | 'json' | 'excel';
  targetModel: 'Paciente' | 'Consulta' | 'Cita';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: MappingResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AIStructurerService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private prisma: PrismaClient;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.prisma = new PrismaClient();

    // Gemini 1.5 Flash - optimizado para velocidad y costo
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,       // Bajo para consistencia en mapeo
        maxOutputTokens: 4096,  // Output grande para mapeos complejos
        topP: 0.8,
        topK: 40
      }
    });
  }

  /**
   * Analiza columnas de archivo y sugiere mapeo a modelo destino
   */
  async analyzeAndMap(
    sampleData: RawDataRow[],
    targetModel: string
  ): Promise<MappingResult> {
    const sourceColumns = Object.keys(sampleData[0] || {});

    // Obtener schema del modelo destino
    const targetSchema = await this.getModelSchema(targetModel);

    // Usar IA para mapear columnas
    const mappings = await this.generateMappings(
      sourceColumns,
      targetSchema
    );

    // Validar y procesar todas las filas
    const { validRows, invalidRows } = await this.validateData(
      sampleData,
      mappings,
      targetSchema
    );

    return {
      sourceColumns,
      targetModel,
      mappings,
      totalRows: sampleData.length,
      validRows,
      invalidRows
    };
  }

  /**
   * Transforma datos crudos a estructura de Galeno
   */
  async transformData(
    rawData: RawDataRow[],
    mappings: ColumnMapping[],
    targetModel: string
  ): Promise<MappedDataRow[]> {
    const transformed: MappedDataRow[] = [];

    for (const row of rawData) {
      try {
        const mappedRow = await this.transformRow(row, mappings, targetModel);
        transformed.push(mappedRow);
      } catch (error) {
        // Registrar error pero continuar con otras filas
        console.error('Error transformando fila:', error);
        transformed.push({
          _error: error.message,
          confidence: 0,
          warnings: ['Error en transformación']
        });
      }
    }

    return transformed;
  }

  /**
   * Valida datos transformados contra schema de Prisma
   */
  async validateTransformedData(
    data: MappedDataRow[],
    targetModel: string
  ): Promise<{ valid: MappedDataRow[]; invalid: MappedDataRow[] }> {
    const valid: MappedDataRow[] = [];
    const invalid: MappedDataRow[] = [];

    const schema = await this.getModelSchema(targetModel);

    for (const row of data) {
      const validation = this.validateRow(row, schema);
      if (validation.valid) {
        valid.push(row);
      } else {
        invalid.push({
          ...row,
          warnings: [...(row.warnings || []), ...validation.errors]
        });
      }
    }

    return { valid, invalid };
  }

  /**
   * Genera mapeo de columnas usando Gemini
   */
  private async generateMappings(
    sourceColumns: string[],
    targetSchema: { modelName: string; fields: TargetField[] }
  ): Promise<ColumnMapping[]> {
    const systemPrompt = `Eres un experto en mapeo de datos médicos.
Tu tarea es mapear columnas de un archivo CSV/Excel a los campos de un modelo de base de datos.

Responde SOLO en formato JSON con esta estructura exacta:
[
  {
    "sourceColumn": "nombre_columna_origen",
    "targetField": "campo_destino",
    "confidence": 0.95,
    "transformation": "uppercase|lowercase|date|phone|trim|null"
  }
]

Reglas:
- confidence: 0-1, qué tan seguro estás del mapeo
- transformation: cómo transformar el dato (null si no necesita transformación)
- Si no hay mapeo claro, omite la columna
- Sé conservador con confidence si el mapeo es ambiguo`;

    const targetFieldsDescription = targetSchema.fields
      .map(f => `- ${f.name} (${f.type}): ${f.description || ''}`)
      .join('\n');

    const sourceColumnsDescription = sourceColumns
      .map(c => `- ${c}`)
      .join('\n');

    const prompt = `
Modelo destino: ${targetSchema.modelName}
Campos disponibles:
${targetFieldsDescription}

Columnas del archivo:
${sourceColumnsDescription}

Genera mapeo óptimo:`;

    try {
      const result = await this.model.generateContent(systemPrompt + prompt);
      const response = result.response.text();
      return this.parseMappingsJSON(response);
    } catch (error) {
      console.error('Error generando mapeo con IA:', error);
      // Fallback: mapeo básico por nombre
      return this.fallbackMapping(sourceColumns, targetSchema.fields);
    }
  }

  /**
   * Transforma una fila individual
   */
  private async transformRow(
    row: RawDataRow,
    mappings: ColumnMapping[],
    targetModel: string
  ): Promise<MappedDataRow> {
    const mappedRow: MappedDataRow = {
      confidence: 1,
      warnings: []
    };

    for (const mapping of mappings) {
      const sourceValue = row[mapping.sourceColumn];
      
      if (sourceValue === null || sourceValue === undefined || sourceValue === '') {
        // Campo opcional o requerido sin valor
        const schema = await this.getModelSchema(targetModel);
        const field = schema.fields.find(f => f.name === mapping.targetField);
        
        if (field?.required) {
          mappedRow.warnings.push(`Campo requerido "${mapping.targetField}" sin valor`);
        }
        continue;
      }

      // Aplicar transformación
      const transformedValue = this.applyTransformation(
        sourceValue,
        mapping.transformation
      );

      mappedRow[mapping.targetField] = transformedValue;
    }

    return mappedRow;
  }

  /**
   * Aplica transformación a valor
   */
  private applyTransformation(
    value: string | number | null,
    transformation?: string
  ): any {
    if (value === null || value === undefined) return null;

    const strValue = String(value).trim();

    switch (transformation) {
      case 'uppercase':
        return strValue.toUpperCase();
      case 'lowercase':
        return strValue.toLowerCase();
      case 'trim':
        return strValue;
      case 'date':
        return this.parseDate(strValue);
      case 'phone':
        return this.normalizePhone(strValue);
      case 'number':
        return Number(strValue);
      case 'boolean':
        return strValue.toLowerCase() === 'true' || strValue === '1';
      default:
        return strValue;
    }
  }

  /**
   * Obtiene schema de modelo Prisma
   */
  private async getModelSchema(modelName: string): Promise<{
    modelName: string;
    fields: TargetField[];
  }> {
    // Schema hardcodeado para modelos principales
    // En producción, se puede obtener dinámicamente de Prisma DMMF
    
    const schemas: Record<string, { modelName: string; fields: TargetField[] }> = {
      Paciente: {
        modelName: 'Paciente',
        fields: [
          { name: 'nombres', type: 'String', required: true, description: 'Nombres del paciente' },
          { name: 'apellidos', type: 'String', required: true, description: 'Apellidos del paciente' },
          { name: 'cedula', type: 'String', required: true, description: 'Cédula/RUC' },
          { name: 'fechaNacimiento', type: 'DateTime', required: false, description: 'Fecha de nacimiento' },
          { name: 'genero', type: 'String', required: false, description: 'Género: M/F/O' },
          { name: 'telefono', type: 'String', required: false, description: 'Teléfono de contacto' },
          { name: 'email', type: 'String', required: false, description: 'Correo electrónico' },
          { name: 'direccion', type: 'String', required: false, description: 'Dirección domiciliaria' },
          { name: 'tipoSangre', type: 'String', required: false, description: 'Tipo de sangre' },
          { name: 'notas', type: 'String', required: false, description: 'Notas adicionales' }
        ]
      },
      Consulta: {
        modelName: 'Consulta',
        fields: [
          { name: 'pacienteId', type: 'String', required: true, description: 'ID del paciente' },
          { name: 'doctorId', type: 'String', required: true, description: 'ID del doctor' },
          { name: 'fecha', type: 'DateTime', required: true, description: 'Fecha de la consulta' },
          { name: 'motivo', type: 'String', required: false, description: 'Motivo de consulta' },
          { name: 'evolucion', type: 'String', required: false, description: 'Evolución del paciente' },
          { name: 'diagnostico', type: 'String', required: false, description: 'Diagnóstico CIE-10' },
          { name: 'tratamiento', type: 'String', required: false, description: 'Tratamiento indicado' }
        ]
      },
      Cita: {
        modelName: 'Cita',
        fields: [
          { name: 'pacienteId', type: 'String', required: true, description: 'ID del paciente' },
          { name: 'doctorId', type: 'String', required: true, description: 'ID del doctor' },
          { name: 'fechaInicio', type: 'DateTime', required: true, description: 'Fecha y hora de inicio' },
          { name: 'fechaFin', type: 'DateTime', required: false, description: 'Fecha y hora de fin' },
          { name: 'estado', type: 'String', required: true, description: 'Estado: programada/completada/cancelada' },
          { name: 'notas', type: 'String', required: false, description: 'Notas de la cita' }
        ]
      }
    };

    return schemas[modelName] || { modelName, fields: [] };
  }

  /**
   * Valida datos contra schema
   */
  private validateRow(
    row: MappedDataRow,
    schema: { modelName: string; fields: TargetField[] }
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of schema.fields) {
      if (field.required && (row[field.name] === null || row[field.name] === undefined)) {
        errors.push(`Campo requerido "${field.name}" faltante`);
      }

      // Validar tipo de dato
      if (row[field.name] !== null && row[field.name] !== undefined) {
        const typeError = this.validateType(row[field.name], field.type);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valida tipo de dato
   */
  private validateType(value: any, expectedType: string): string | null {
    switch (expectedType) {
      case 'String':
        return typeof value === 'string' ? null : 'Debe ser texto';
      case 'Int':
        return Number.isInteger(Number(value)) ? null : 'Debe ser número entero';
      case 'Float':
        return !isNaN(Number(value)) ? null : 'Debe ser número';
      case 'DateTime':
        return !isNaN(Date.parse(value)) ? null : 'Debe ser fecha válida';
      case 'Boolean':
        return typeof value === 'boolean' ? null : 'Debe ser verdadero/falso';
      default:
        return null;
    }
  }

  /**
   * Valida todas las filas de datos
   */
  private async validateData(
    data: RawDataRow[],
    mappings: ColumnMapping[],
    targetSchema: { modelName: string; fields: TargetField[] }
  ): Promise<{ validRows: number; invalidRows: number }> {
    let validRows = 0;
    let invalidRows = 0;

    for (const row of data) {
      const mappedRow = await this.transformRow(row, mappings, targetSchema.modelName);
      const validation = this.validateRow(mappedRow, targetSchema);
      
      if (validation.valid) {
        validRows++;
      } else {
        invalidRows++;
      }
    }

    return { validRows, invalidRows };
  }

  /**
   * Parsea JSON de respuesta de IA
   */
  private parseMappingsJSON(text: string): ColumnMapping[] {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Mapeo fallback cuando IA falla
   */
  private fallbackMapping(
    sourceColumns: string[],
    targetSchema: TargetField[]
  ): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedTargets = targetSchema.map(f => ({
      ...f,
      normalized: f.name.toLowerCase().replace(/[_-]/g, '')
    }));

    for (const source of sourceColumns) {
      const normalizedSource = source.toLowerCase().replace(/[_-]/g, '');
      
      // Buscar coincidencia exacta
      const exactMatch = normalizedTargets.find(
        t => t.normalized === normalizedSource
      );

      if (exactMatch) {
        mappings.push({
          sourceColumn: source,
          targetField: exactMatch.name,
          confidence: 0.9,
          transformation: this.inferTransformation(source)
        });
      } else {
        // Búsqueda difusa básica
        const fuzzyMatch = normalizedTargets.find(
          t => t.normalized.includes(normalizedSource) || 
               normalizedSource.includes(t.normalized)
        );

        if (fuzzyMatch) {
          mappings.push({
            sourceColumn: source,
            targetField: fuzzyMatch.name,
            confidence: 0.6,
            transformation: this.inferTransformation(source)
          });
        }
      }
    }

    return mappings;
  }

  /**
   * Infiere transformación basada en nombre de columna
   */
  private inferTransformation(columnName: string): string | undefined {
    const lower = columnName.toLowerCase();
    
    if (lower.includes('fecha') || lower.includes('date')) return 'date';
    if (lower.includes('telefono') || lower.includes('phone') || lower.includes('tel')) return 'phone';
    if (lower.includes('email') || lower.includes('correo')) return 'lowercase';
    if (lower.includes('id') || lower.includes('codigo')) return 'trim';
    if (lower.includes('activo') || lower.includes('estado')) return 'boolean';
    if (lower.includes('cantidad') || lower.includes('monto') || lower.includes('valor')) return 'number';
    
    return undefined;
  }

  /**
   * Parsea fecha de varios formatos
   */
  private parseDate(value: string): Date | null {
    // Intentar varios formatos comunes
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/,         // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/,           // DD-MM-YYYY
      /^(\d{4})\/(\d{2})\/(\d{2})$/          // YYYY/MM/DD
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Fallback: parse nativo
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Normaliza número de teléfono
   */
  private normalizePhone(value: string): string {
    // Remover todos los caracteres no numéricos
    const digits = value.replace(/\D/g, '');
    
    // Formato Ecuador: 10 dígitos
    if (digits.length === 10) {
      return digits;
    }
    
    // Con código de país
    if (digits.length === 12 && digits.startsWith('593')) {
      return digits.slice(3);
    }

    return value; // Retornar original si no coincide
  }
}

interface TargetField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Singleton
export const aiStructurerService = new AIStructurerService();
