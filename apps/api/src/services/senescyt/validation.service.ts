import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

export interface SenescytValidationRequest {
  cedula: string;
  numeroTitulo: string;
  codigoUniversidad: string;
}

export interface SenescytValidationResponse {
  valido: boolean;
  nombreProfesional: string;
  tituloProfesional: string;
  universidad: string;
  fechaRegistro: string;
  fechaExpedicion: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
}

export interface ValidationStatus {
  doctorId: string;
  validado: boolean;
  fechaValidacion: Date;
  respuesta?: SenescytValidationResponse;
}

/**
 * Senescyt Validation Service
 * Validates medical titles against Ecuador's SENESCYT API
 * 
 * BIZ-001: Enhanced with caching, retry logic, and sync
 */
export class SenescytValidationService {
  private readonly API_BASE_URL = process.env.SENECYT_API_URL || 'https://api.senescyt.gob.ec/v1';
  private readonly API_KEY = process.env.SENECYT_API_KEY || '';
  private readonly TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Validates a medical title against SENESCYT API with retry logic
   */
  async validateTitulo(
    request: SenescytValidationRequest
  ): Promise<SenescytValidationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Check cache first
        const cached = await this.getCachedValidation(request);
        if (cached) {
          logger.info({ request, cache: true }, 'Returning cached validation');
          return cached;
        }

        // Validate input
        this.validateInput(request);

        const response = await axios.post<SenescytValidationResponse>(
          `${this.API_BASE_URL}/titulos/validar`,
          {
            cedula: request.cedula,
            numeroTitulo: request.numeroTitulo,
            codigoUniversidad: request.codigoUniversidad
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.API_KEY}`
            },
            timeout: this.TIMEOUT
          }
        );

        const result = this.parseResponse(response.data);

        // Cache the result
        await this.cacheValidation(request, result);

        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on validation errors
        if (error instanceof Error && error.message.includes('Invalid')) {
          throw error;
        }

        // Exponential backoff
        if (attempt < this.MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn({ attempt, delay, error }, 'Retrying SENESCYT validation');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error({ error: lastError, request }, 'All retries failed');
    throw lastError || new Error('SENESCYT validation failed after all retries');
  }

  /**
   * Get cached validation result
   */
  private async getCachedValidation(
    request: SenescytValidationRequest
  ): Promise<SenescytValidationResponse | null> {
    try {
      const cache = await prisma.senescytCache.findFirst({
        where: {
          cedula: request.cedula,
          numeroTitulo: request.numeroTitulo,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (cache) {
        return cache.result as any as SenescytValidationResponse;
      }

      return null;
    } catch (error) {
      logger.error({ error }, 'Error reading cache');
      return null;
    }
  }

  /**
   * Cache validation result
   */
  private async cacheValidation(
    request: SenescytValidationRequest,
    result: SenescytValidationResponse
  ): Promise<void> {
    try {
      await prisma.senescytCache.upsert({
        where: {
          cedula_numeroTitulo: {
            cedula: request.cedula,
            numeroTitulo: request.numeroTitulo
          }
        },
        update: {
          result: result as any,
          expiresAt: new Date(Date.now() + this.CACHE_TTL)
        },
        create: {
          cedula: request.cedula,
          numeroTitulo: request.numeroTitulo,
          result: result as any,
          expiresAt: new Date(Date.now() + this.CACHE_TTL)
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error caching validation');
    }
  }

  /**
   * Validates input fields
   */
  private validateInput(request: SenescytValidationRequest): void {
    if (!request.cedula || request.cedula.trim().length === 0) {
      throw new Error('Cédula is required');
    }

    if (!request.numeroTitulo || request.numeroTitulo.trim().length === 0) {
      throw new Error('Número de título is required');
    }

    if (!request.codigoUniversidad || request.codigoUniversidad.trim().length === 0) {
      throw new Error('Código de universidad is required');
    }

    // Validate cedula format (Ecuadorian ID - 10 digits)
    const cedulaRegex = /^\d{10}$/;
    if (!cedulaRegex.test(request.cedula)) {
      throw new Error('Invalid cédula format. Must be 10 digits');
    }
  }

  /**
   * Parses API response
   */
  private parseResponse(data: any): SenescytValidationResponse {
    return {
      valido: data.valido === true || data.estado === 'ACTIVO',
      nombreProfesional: data.nombreProfesional || data.nombre || '',
      tituloProfesional: data.tituloProfesional || data.titulo || '',
      universidad: data.universidad || data.institucion || '',
      fechaRegistro: data.fechaRegistro || data.fecha_registro || '',
      fechaExpedicion: data.fechaExpedicion || data.fecha_expedicion || '',
      estado: (data.estado as 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO') || 'ACTIVO'
    };
  }

  /**
   * Handles API errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 404) {
        return new Error('Título no encontrado en registros de SENESCYT');
      }

      if (axiosError.response?.status === 401) {
        return new Error('Error de autenticación con API de SENESCYT');
      }

      if (axiosError.response?.status === 429) {
        return new Error('Límite de peticiones alcanzado. Intente más tarde');
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new Error('Tiempo de espera agotado. Intente nuevamente');
      }
    }

    return new Error('Error al validar título con SENESCYT');
  }

  /**
   * Validates a doctor's title and updates their status
   * @param doctorId - Doctor's ID
   * @param cedula - Doctor's cedula
   * @param numeroTitulo - Title number
   * @param codigoUniversidad - University code
   * @returns Validation status
   */
  async validarDoctor(
    doctorId: string,
    cedula: string,
    numeroTitulo: string,
    codigoUniversidad: string
  ): Promise<ValidationStatus> {
    try {
      const response = await this.validateTitulo({
        cedula,
        numeroTitulo,
        codigoUniversidad
      });

      const status: ValidationStatus = {
        doctorId,
        validado: response.valido && response.estado === 'ACTIVO',
        fechaValidacion: new Date(),
        respuesta: response
      };

      // Persist validation result to database
      await prisma.cuenta.update({
        where: { id: doctorId },
        data: {
          senescytValidado: status.validado,
          senescytFechaValidacion: status.validado ? new Date() : null,
          senescytRespuesta: status.respuesta as any
        }
      } as any);

      logger.info({
        doctorId,
        validado: status.validado,
        nombreProfesional: response.nombreProfesional
      }, 'Doctor title validated with SENESCYT');

      return status;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error validating doctor title');
      throw error;
    }
  }

  /**
   * Gets validation status for a doctor
   * @param doctorId - Doctor's ID
   * @returns Validation status or null
   */
  async getValidationStatus(doctorId: string): Promise<ValidationStatus | null> {
    try {
      const doctor = await prisma.cuenta.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          senescytValidado: true,
          senescytFechaValidacion: true,
          senescytRespuesta: true
        }
      } as any) as any;

      if (!doctor) {
        return null;
      }

      return {
        doctorId: doctor.id,
        validado: doctor.senescytValidado,
        fechaValidacion: doctor.senescytFechaValidacion || undefined,
        respuesta: doctor.senescytRespuesta as SenescytValidationResponse | undefined
      };
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting validation status');
      return null;
    }
  }

  // ============= BIZ-001: NUEVAS FUNCIONALIDADES =============

  /**
   * Sync validations for all pending doctors
   * @returns Summary of sync operation
   */
  async syncPendingValidations(): Promise<{
    total: number;
    validated: number;
    failed: number;
    skipped: number;
  }> {
    const pendingDoctors = await prisma.cuenta.findMany({
      where: {
        rol: 'DOCTOR',
        senescytValidado: false
      },
      select: {
        id: true,
        nombre: true,
        email: true
      },
      take: 100 // Batch processing
    });

    const result = {
      total: pendingDoctors.length,
      validated: 0,
      failed: 0,
      skipped: 0
    };

    for (const doctor of pendingDoctors) {
      try {
        // Check if we have cached validation
        const cached = await prisma.senescytCache.findFirst({
          where: {
            cedula: doctor.email, // Using email as cedula placeholder
            expiresAt: {
              gt: new Date()
            }
          }
        });

        if (cached) {
          result.skipped++;
          continue;
        }

        // TODO: Implement actual validation with stored cedula/titulo
        // This requires additional fields in Cuenta model or separate DoctorProfile model
        
      } catch (error) {
        logger.error({ error, doctorId: doctor.id }, 'Error syncing doctor validation');
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Generate validation report
   * @param startDate - Report start date
   * @param endDate - Report end date
   * @returns Validation statistics
   */
  async generateReport(startDate: Date, endDate: Date): Promise<{
    totalValidations: number;
    approved: number;
    rejected: number;
    pending: number;
    byDate: Array<{ date: string; count: number }>;
  }> {
    const validations = await prisma.cuenta.findMany({
      where: {
        senescytFechaValidacion: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        senescytValidado: true,
        senescytFechaValidacion: true
      }
    });

    const totalValidations = validations.length;
    const approved = validations.filter(v => v.senescytValidado).length;
    const rejected = totalValidations - approved;

    // Group by date
    const byDateMap = new Map<string, number>();
    validations.forEach(v => {
      if (v.senescytFechaValidacion) {
        const date = v.senescytFechaValidacion.toISOString().split('T')[0];
        byDateMap.set(date, (byDateMap.get(date) || 0) + 1);
      }
    });

    const byDate = Array.from(byDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalValidations,
      approved,
      rejected,
      pending: 0, // Would need separate tracking
      byDate
    };
  }

  /**
   * Clear expired cache entries
   * @returns Number of entries cleared
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const result = await prisma.senescytCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      logger.info({ cleared: result.count }, 'Cleared expired SENESCYT cache');
      return result.count;
    } catch (error) {
      logger.error({ error }, 'Error clearing expired cache');
      return 0;
    }
  }
}

export default new SenescytValidationService();
