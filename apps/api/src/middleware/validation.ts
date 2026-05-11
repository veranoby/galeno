import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Schema for creating availability slots
const crearSlotSchema = z.object({
  ubicacionId: z.string().optional(),
  diaSemana: z.number().min(0).max(6), // 0-6 (Domingo-Sábado)
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
  horaFin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
  duracionMinutos: z.number().min(15).max(240), // Between 15 and 240 minutes
  tipo: z.enum(['presencial',  'teleconsulta'])
});

// Schema for updating availability slots
const actualizarSlotSchema = z.object({
  ubicacionId: z.string().optional(),
  diaSemana: z.number().min(0).max(6).optional(),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  duracionMinutos: z.number().min(15).max(240).optional(),
  tipo: z.enum(['presencial',  'teleconsulta']).optional(),
  activo: z.boolean().optional()
});

// Schema for creating reservations
const crearReservaSchema = z.object({
  doctorId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  fechaHora: z.string().datetime(),
  tipo: z.enum(['presencial',  'teleconsulta']),
  ubicacionId: z.string().uuid().optional()
});

// Schema for creating appointments
const crearCitaSchema = z.object({
  pacienteId: z.string().uuid(),
  ubicacionId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  fechaHora: z.string().datetime(),
  tipo: z.enum(['presencial',  'teleconsulta']),
  estado: z.enum(['programada',  'confirmada',  'en_progreso',  'completada',  'cancelada',  'no_presento']).optional()
});

// Schema for updating appointments
const actualizarCitaSchema = z.object({
  ubicacionId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  fechaHora: z.string().datetime().optional(),
  tipo: z.enum(['presencial',  'teleconsulta']).optional(),
  estado: z.enum(['programada',  'confirmada',  'en_progreso',  'completada',  'cancelada',  'no_presento']).optional(),
  motivoCancelacion: z.string().optional()
});

export function validateDisponibilidad(action: 'create' | 'update') {
  return (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const schema = action === 'create' ? crearSlotSchema : actualizarSlotSchema;
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false, 
          error: 'Validation failed', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateReserva(action: 'create') {
  return (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const schema = crearReservaSchema;
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false, 
          error: 'Validation failed', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateCita(action: 'create' | 'update') {
  return (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const schema = action === 'create' ? crearCitaSchema : actualizarCitaSchema;
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false, 
          error: 'Validation failed', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}