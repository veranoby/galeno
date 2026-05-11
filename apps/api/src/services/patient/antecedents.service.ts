import { PrismaClient, TipoAntecedente, RegistradoPor } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

/**
 * DTO para crear un antecedente
 */
export interface CreateAntecedenteDto {
  pacienteId: string;
  tipo: TipoAntecedente;
  categoria?: string;
  detalle: string;
  grado?: string;
  registradoPor?: RegistradoPor;
}

/**
 * DTO para actualizar un antecedente
 */
export interface UpdateAntecedenteDto {
  tipo?: TipoAntecedente;
  categoria?: string;
  detalle?: string;
  grado?: string;
}

/**
 * Validaciones específicas por tipo de antecedente
 */
const VALIDACIONES_POR_TIPO: Record<TipoAntecedente, { camposRequeridos: string[]; categoriasPermitidas?: string[] }> = {
  personal: {
    camposRequeridos: ['categoria', 'detalle'],
    categoriasPermitidas: ['patológico', 'quirúrgico', 'traumático', 'alérgico', 'ginecoobstétrico', 'otros']
  },
  familiar: {
    camposRequeridos: ['categoria', 'detalle'],
    categoriasPermitidas: ['padre', 'madre', 'hermanos', 'abuelos', 'tíos', 'otros']
  },
  medicamento: {
    camposRequeridos: ['categoria', 'detalle'],
    categoriasPermitidas: ['actual', 'previo']
  },
  habito: {
    camposRequeridos: ['categoria', 'detalle'],
    categoriasPermitidas: ['tabaco', 'alcohol', 'drogas', 'cafeína', 'ejercicio', 'dieta', 'sueño', 'otros']
  },
  alergia: {
    camposRequeridos: ['categoria', 'detalle'],
    categoriasPermitidas: ['medicamento', 'alimento', 'ambiente', 'otros']
  }
};

/**
 * AntecedentsService - Servicio para gestión de antecedentes del paciente
 *
 * Maneja el CRUD completo de antecedentes con validaciones específicas por tipo.
 */
export class AntecedentsService {
  /**
   * Validar datos de antecedente según su tipo
   */
  private validarAntecedente(tipo: TipoAntecedente,  data: CreateAntecedenteDto | UpdateAntecedenteDto): void {
    const validacion = VALIDACIONES_POR_TIPO[tipo];

    // Verificar campos requeridos
    for (const campo of validacion.camposRequeridos) {
      if (!(campo in data) || data[campo as keyof typeof data] === undefined || data[campo as keyof typeof data] === '') {
        throw new Error(`El campo '${campo}' es requerido para antecedentes tipo '${tipo}'`);
      }
    }

    // Validar categoría si está presente
    if ('categoria' in data && data.categoria && validacion.categoriasPermitidas) {
      if (!validacion.categoriasPermitidas.includes(data.categoria)) {
        throw new Error(`Categoría inválida para '${tipo}'. Permitidas: ${validacion.categoriasPermitidas.join(',  ')}`);
      }
    }
  }

  /**
   * Crear un nuevo antecedente
   */
  async create(data: CreateAntecedenteDto) {
    // Validar según tipo
    this.validarAntecedente(data.tipo,  data);

    // Validar que el paciente existe
    const paciente = await prisma.paciente.findUnique({
      where: { id: data.pacienteId }
    });

    if (!paciente) {
      throw new Error('Paciente no encontrado');
    }

    // Crear antecedente
    const antecedente = await prisma.antecedentePaciente.create({
      data: {
        pacienteId: data.pacienteId, 
        tipo: data.tipo, 
        categoria: data.categoria, 
        detalle: data.detalle, 
        grado: data.grado, 
        registradoPor: data.registradoPor || 'doctor'
      }
    });

    logger.info({
      antecedenteId: antecedente.id, 
      pacienteId: data.pacienteId, 
      tipo: data.tipo
    },  'Antecedente creado');

    return antecedente;
  }

  /**
   * Obtener todos los antecedentes de un paciente
   */
  async findAll(pacienteId: string,  tipo?: TipoAntecedente) {
    const where: any = { pacienteId };

    if (tipo) {
      where.tipo = tipo;
    }

    return await prisma.antecedentePaciente.findMany({
      where, 
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Obtener un antecedente por ID
   */
  async findOne(id: string) {
    const antecedente = await prisma.antecedentePaciente.findUnique({
      where: { id }
    });

    if (!antecedente) {
      throw new Error('Antecedente no encontrado');
    }

    return antecedente;
  }

  /**
   * Obtener antecedentes por tipo
   */
  async findByTipo(pacienteId: string,  tipo: TipoAntecedente) {
    return await this.findAll(pacienteId,  tipo);
  }

  /**
   * Actualizar un antecedente
   */
  async update(id: string,  data: UpdateAntecedenteDto) {
    // Verificar que existe
    const existente = await this.findOne(id);

    // Si cambia el tipo, validar con el nuevo tipo
    const nuevoTipo = data.tipo || existente.tipo;
    if (data.tipo) {
      this.validarAntecedente(nuevoTipo,  data);
    }

    // Actualizar
    const antecedente = await prisma.antecedentePaciente.update({
      where: { id }, 
      data: {
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.categoria !== undefined && { categoria: data.categoria }),
        ...(data.detalle !== undefined && { detalle: data.detalle }),
        ...(data.grado !== undefined && { grado: data.grado })
      }
    });

    logger.info({
      antecedenteId: id, 
      cambios: Object.keys(data)
    }, 'Antecedente actualizado');

    return antecedente;
  }

  /**
   * Eliminar un antecedente
   */
  async delete(id: string) {
    // Verificar que existe
    await this.findOne(id);

    await prisma.antecedentePaciente.delete({
      where: { id }
    });

    logger.info({ antecedenteId: id },  'Antecedente eliminado');
  }

  /**
   * Obtener resumen de antecedentes por tipo
   */
  async getResumen(pacienteId: string) {
    const antecedentes = await this.findAll(pacienteId);

    const resumen: Record<TipoAntecedente, number> = {
      personal: 0,
      familiar: 0,
      medicamento: 0,
      habito: 0,
      alergia: 0
    };

    for (const antecedente of antecedentes) {
      resumen[antecedente.tipo]++;
    }

    return {
      total: antecedentes.length,
      porTipo: resumen
    };
  }

  /**
   * Buscar antecedentes por texto en detalle o categoría
   */
  async search(pacienteId: string,  query: string) {
    return await prisma.antecedentePaciente.findMany({
      where: {
        pacienteId, 
        OR: [
          { detalle: { contains: query,  mode: 'insensitive' } }, 
          { categoria: { contains: query,  mode: 'insensitive' } }
        ]
      }, 
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}

export default new AntecedentsService();
