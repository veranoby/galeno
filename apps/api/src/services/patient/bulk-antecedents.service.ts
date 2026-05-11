import { PrismaClient } from '@prisma/client';
import { CreateAntecedenteDto } from './antecedents.service.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Interface para el resultado de la importación masiva
 */
export interface BulkImportResult {
  imported: number;
  errors: Array<{
    index: number;
    error: string;
    record: any;
  }>;
}

/**
 * Servicio para importación masiva de antecedentes
 */
export class BulkAntecedentsService {
  /**
   * Importar antecedentes masivamente con validación y transacciones
   */
  async bulkImport(pacienteId: string, antecedentesData: CreateAntecedenteDto[]): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      imported: 0,
      errors: []
    };

    // Validar que el paciente existe
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId }
    });

    if (!paciente) {
      throw new Error('Paciente no encontrado');
    }

    // Validar cada registro antes de procesar
    const validatedData = antecedentesData.map((data, index) => {
      try {
        // Validar estructura básica
        if (!data.tipo || !data.detalle) {
          throw new Error('Los campos "tipo" y "detalle" son requeridos');
        }

        // Validar tipo de antecedente
        if (!['personal', 'familiar', 'medicamento', 'habito', 'alergia'].includes(data.tipo)) {
          throw new Error(`Tipo de antecedente inválido: ${data.tipo}`);
        }

        // Validar categoría si está presente
        if (data.categoria) {
          const categoriasValidas = this.getCategoriasValidas(data.tipo);
          if (!categoriasValidas.includes(data.categoria)) {
            throw new Error(`Categoría inválida para tipo '${data.tipo}': ${data.categoria}`);
          }
        }

        // Validar registradoPor si está presente
        if (data.registradoPor && !['paciente', 'enfermera', 'doctor'].includes(data.registradoPor)) {
          throw new Error(`Valor inválido para registradoPor: ${data.registradoPor}`);
        }

        // Agregar valores por defecto
        return {
          ...data,
          pacienteId,
          registradoPor: data.registradoPor || 'doctor'
        };
      } catch (error: any) {
        result.errors.push({
          index,
          error: error.message,
          record: data
        });
        return null;
      }
    }).filter(Boolean) as CreateAntecedenteDto[];

    // Si todos los registros tuvieron errores, retornar sin procesar
    if (result.errors.length === antecedentesData.length) {
      return result;
    }

    // Procesar solo los registros válidos
    const validRecords = validatedData.filter(record => record !== null) as CreateAntecedenteDto[];

    // Usar transacción para asegurar consistencia
    try {
      await prisma.$transaction(async (tx) => {
        // Procesar cada registro válido
        for (let i = 0; i < validRecords.length; i++) {
          const record = validRecords[i];
          const originalIndex = antecedentesData.indexOf(validRecords[i]);
          
          try {
            await tx.antecedentePaciente.create({
              data: {
                pacienteId: record.pacienteId,
                tipo: record.tipo,
                categoria: record.categoria,
                detalle: record.detalle,
                grado: record.grado,
                registradoPor: record.registradoPor
              }
            });
            
            result.imported++;
          } catch (error: any) {
            // Si hay un error al insertar, agregarlo a los errores
            result.errors.push({
              index: originalIndex,
              error: error.message,
              record: record
            });
          }
        }
      });
    } catch (error: any) {
      logger.error({ error, pacienteId }, 'Error en la transacción de importación masiva');
      throw error;
    }

    logger.info({
      pacienteId,
      imported: result.imported,
      errors: result.errors.length
    }, 'Importación masiva de antecedentes completada');

    return result;
  }

  /**
   * Obtener categorías válidas para un tipo de antecedente
   */
  private getCategoriasValidas(tipo: string): string[] {
    switch (tipo) {
      case 'personal':
        return ['patológico', 'quirúrgico', 'traumático', 'alérgico', 'ginecoobstétrico', 'otros'];
      case 'familiar':
        return ['padre', 'madre', 'hermanos', 'abuelos', 'tíos', 'otros'];
      case 'medicamento':
        return ['actual', 'previo'];
      case 'habito':
        return ['tabaco', 'alcohol', 'drogas', 'cafeína', 'ejercicio', 'dieta', 'sueño', 'otros'];
      case 'alergia':
        return ['medicamento', 'alimento', 'ambiente', 'otros'];
      default:
        return [];
    }
  }
}

/**
 * Función exportada para uso directo
 */
export const bulkImportAntecedents = async (
  pacienteId: string,
  antecedentesData: CreateAntecedenteDto[]
): Promise<BulkImportResult> => {
  const service = new BulkAntecedentsService();
  return await service.bulkImport(pacienteId, antecedentesData);
};