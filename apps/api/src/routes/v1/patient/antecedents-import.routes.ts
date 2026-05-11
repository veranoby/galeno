import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, canAccessPatient } from '../../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';
import { bulkImportAntecedents } from '../../../services/patient/bulk-antecedents.service.js';
import multer from 'multer';

const router: Router = Router();

// Configurar multer para manejar uploads de archivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Permitir solo archivos CSV y JSON
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/json' ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Solo se permiten archivos CSV y JSON.'));
    }
  }
});

/**
 * @openapi
 * /api/v1/patients/{id}/antecedents/import:
 *   post:
 *     summary: Importar antecedentes masivamente desde CSV/JSON
 *     tags: [Antecedentes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resultado de la importación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     imported:
 *                       type: integer
 *                       description: Número de antecedentes importados exitosamente
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           index:
 *                             type: integer
 *                             description: Índice del registro con error
 *                           error:
 *                             type: string
 *                             description: Descripción del error
 *                           record:
 *                             type: object
 *                             description: Registro que causó el error
 */
router.post('/:id/antecedents/import', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const pacienteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Verificar acceso al paciente
    const hasAccess = await canAccessPatient(req, pacienteId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No tienes permisos para acceder a este paciente'
      });
    }

    // Verificar que se haya enviado el archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Debe enviar un archivo CSV o JSON'
      });
    }

    let antecedentesData: any[];

    // Parsear el archivo según el tipo
    if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      // Para CSV, parsear el contenido
      const csvContent = req.file.buffer.toString('utf-8');
      antecedentesData = parseCSVToAntecedentes(csvContent);
    } else if (req.file.mimetype === 'application/json' || req.file.originalname.endsWith('.json')) {
      // Para JSON, parsear directamente
      antecedentesData = JSON.parse(req.file.buffer.toString('utf-8'));
    } else {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Formato de archivo no soportado. Se aceptan CSV y JSON.'
      });
    }

    // Validar estructura de los datos
    const validationErrors = validateAntecedentesData(antecedentesData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Datos inválidos para importar antecedentes',
        details: validationErrors
      });
    }

    // Realizar la importación masiva
    const result = await bulkImportAntecedents(pacienteId, antecedentesData);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    const pacienteId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
    logger.error({ error, pacienteId }, 'Error al importar antecedentes masivamente');

    if (error.message.includes('CSV parsing error')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Error al procesar el archivo CSV. Formato incorrecto.'
      });
    }

    if (error.message.includes('JSON parsing error')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Error al procesar el archivo JSON. Formato incorrecto.'
      });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'El archivo es demasiado grande. Máximo 10MB permitido.'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error al importar antecedentes'
    });
  }
});

/**
 * Función para parsear CSV a antecedentes
 */
function parseCSVToAntecedentes(csvContent: string): any[] {
  try {
    // Dividir el CSV en líneas
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('CSV parsing error: El archivo CSV debe tener al menos una fila de encabezado y una de datos');
    }

    // Extraer encabezados (manejar posibles comillas)
    const headersLine = lines[0];
    const headers = parseCSVLine(headersLine);

    // Validar encabezados requeridos
    const requiredHeaders = ['tipo', 'detalle'];
    for (const requiredHeader of requiredHeaders) {
      if (!headers.some(h => h.toLowerCase() === requiredHeader)) {
        throw new Error(`CSV parsing error: Columna requerida "${requiredHeader}" no encontrada en el archivo CSV`);
      }
    }

    // Procesar filas de datos
    const antecedentes: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // Saltar líneas vacías
      
      const values = parseCSVLine(lines[i]);
      const antecedente: any = {};

      for (let j = 0; j < headers.length; j++) {
        if (j < values.length) {
          // Remover comillas dobles y espacios innecesarios
          const value = values[j].trim();
          
          // Convertir valores vacíos a undefined
          antecedente[headers[j].toLowerCase()] = value === '' ? undefined : value;
        }
      }

      antecedentes.push(antecedente);
    }

    return antecedentes;
  } catch (error) {
    throw new Error(`CSV parsing error: ${(error as Error).message}`);
  }
}

/**
 * Función auxiliar para parsear una línea de CSV manejando comillas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Doble comilla dentro de campo entrecomillado se interpreta como comilla literal
        current += '"';
        i++; // Saltar la siguiente comilla
      } else {
        // Alternar estado de comillas
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Separador fuera de comillas
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Agregar último campo
  result.push(current);
  return result;
}

/**
 * Función para validar la estructura de los datos de antecedentes
 */
function validateAntecedentesData(data: any[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Validar campos requeridos
    if (!item.tipo) {
      errors.push(`Registro ${i}: El campo 'tipo' es requerido`);
    } else if (!['personal', 'familiar', 'medicamento', 'habito', 'alergia'].includes(item.tipo)) {
      errors.push(`Registro ${i}: El tipo '${item.tipo}' no es válido`);
    }

    if (!item.detalle) {
      errors.push(`Registro ${i}: El campo 'detalle' es requerido`);
    }

    // Validar categoría si está presente
    if (item.categoria && !['patológico', 'quirúrgico', 'traumático', 'alérgico', 'ginecoobstétrico', 'otros',
                            'padre', 'madre', 'hermanos', 'abuelos', 'tíos',
                            'actual', 'previo',
                            'tabaco', 'alcohol', 'drogas', 'cafeína', 'ejercicio', 'dieta', 'sueño',
                            'medicamento', 'alimento', 'ambiente'].includes(item.categoria)) {
      errors.push(`Registro ${i}: La categoría '${item.categoria}' no es válida`);
    }

    // Validar registradoPor si está presente
    if (item.registradoPor && !['paciente', 'enfermera', 'doctor'].includes(item.registradoPor)) {
      errors.push(`Registro ${i}: El valor '${item.registradoPor}' para 'registradoPor' no es válido`);
    }
  }

  return errors;
}

export default router;