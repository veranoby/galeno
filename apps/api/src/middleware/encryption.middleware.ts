import { Request, Response, NextFunction } from 'express';
import { encryptedField, decryptField } from '../utils/crypto';
import AuditService from '../services/audit/audit.service';

/**
 * Middleware to encrypt sensitive fields in request body
 * Compliance: LOPDP (Ley Orgánica de Protección de Datos Personales - Ecuador)
 */
export const encryptSensitiveFields = async (req: Request,  res: Response,  next: NextFunction) => {
  try {
    // Encrypt sensitive fields in request body
    if (req.body) {
      // Encrypt patient phone numbers
      if (req.body.telefono) {
        req.body.telefono = encryptedField(req.body.telefono);
      }

      // Encrypt patient emails
      if (req.body.email) {
        req.body.email = encryptedField(req.body.email);
      }

      // Encrypt medical data
      if (req.body.motivoConsulta) {
        req.body.motivoConsulta = encryptedField(req.body.motivoConsulta);
      }

      if (req.body.evolucion) {
        req.body.evolucion = encryptedField(req.body.evolucion);
      }

      if (req.body.diagnosticoCie10) {
        req.body.diagnosticoCie10 = typeof req.body.diagnosticoCie10 === 'string' 
          ? req.body.diagnosticoCie10 
          : encryptedField(JSON.stringify(req.body.diagnosticoCie10));
      }

      if (req.body.recetaJson) {
        req.body.recetaJson = typeof req.body.recetaJson === 'string' 
          ? req.body.recetaJson 
          : encryptedField(JSON.stringify(req.body.recetaJson));
      }

      if (req.body.examenesJson) {
        req.body.examenesJson = typeof req.body.examenesJson === 'string' 
          ? req.body.examenesJson 
          : encryptedField(JSON.stringify(req.body.examenesJson));
      }

      // Encrypt antecedente details
      if (req.body.detalle) {
        req.body.detalle = encryptedField(req.body.detalle);
      }

      // Encrypt document content
      if (req.body.contenido) {
        req.body.contenido = typeof req.body.contenido === 'string' 
          ? req.body.contenido 
          : encryptedField(JSON.stringify(req.body.contenido));
      }

      // Encrypt connection permissions
      if (req.body.permisos) {
        req.body.permisos = typeof req.body.permisos === 'string' 
          ? req.body.permisos 
          : encryptedField(JSON.stringify(req.body.permisos));
      }
    }

    next();
  } catch (error) {
    console.error('Encryption middleware error:', error);
    res.status(500).json({ error: 'Encryption error' });
  }
};

/**
 * Middleware to decrypt sensitive fields in response
 * Compliance: LOPDP (Ley Orgánica de Protección de Datos Personales - Ecuador)
 */
export const decryptSensitiveFields = async (req: Request,  res: Response,  next: NextFunction) => {
  // Store original JSON method
  const originalJson = res.json;

  // Override JSON method to decrypt sensitive fields before sending response
  res.json = function(data: any) {
    try {
      if (data && typeof data === 'object') {
        // Deep clone to avoid modifying original data
        const responseData = JSON.parse(JSON.stringify(data));

        // Decrypt sensitive fields in response
        if (responseData.telefono) {
          responseData.telefono = decryptField(responseData.telefono);
        }

        if (responseData.email) {
          responseData.email = decryptField(responseData.email);
        }

        if (responseData.motivoConsulta) {
          responseData.motivoConsulta = decryptField(responseData.motivoConsulta);
        }

        if (responseData.evolucion) {
          responseData.evolucion = decryptField(responseData.evolucion);
        }

        if (responseData.diagnosticoCie10) {
          try {
            responseData.diagnosticoCie10 = JSON.parse(decryptField(responseData.diagnosticoCie10));
          } catch {
            responseData.diagnosticoCie10 = decryptField(responseData.diagnosticoCie10);
          }
        }

        if (responseData.recetaJson) {
          try {
            responseData.recetaJson = JSON.parse(decryptField(responseData.recetaJson));
          } catch {
            responseData.recetaJson = decryptField(responseData.recetaJson);
          }
        }

        if (responseData.examenesJson) {
          try {
            responseData.examenesJson = JSON.parse(decryptField(responseData.examenesJson));
          } catch {
            responseData.examenesJson = decryptField(responseData.examenesJson);
          }
        }

        if (responseData.detalle) {
          responseData.detalle = decryptField(responseData.detalle);
        }

        if (responseData.contenido) {
          try {
            responseData.contenido = JSON.parse(decryptField(responseData.contenido));
          } catch {
            responseData.contenido = decryptField(responseData.contenido);
          }
        }

        if (responseData.permisos) {
          try {
            responseData.permisos = JSON.parse(decryptField(responseData.permisos));
          } catch {
            responseData.permisos = decryptField(responseData.permisos);
          }
        }

        // Log access to sensitive data
        if (req.user) {
          AuditService.log({
            userId: req.user.id,
            action: 'RESOURCE_ACCESS',
            resourceType: 'PACIENTE',
            resourceId: data.id || null,
            rolUsuario: req.user.rol || 'UNKNOWN',
            ip: req.ip,
            metadata: {
              fields: Object.keys(responseData).filter(key =>
                ['telefono', 'email', 'motivoConsulta', 'evolucion', 'diagnosticoCie10',
                 'recetaJson', 'examenesJson', 'detalle', 'contenido', 'permisos'].includes(key)
              )
            }
          }).catch(err => console.error('Audit log error:', err));
        }

        return originalJson.call(this,  responseData);
      }
    } catch (error) {
      console.error('Decryption middleware error:', error);
      return originalJson.call(this,  { error: 'Decryption error' });
    }

    return originalJson.call(this,  data);
  };

  next();
};

/**
 * Middleware to apply encryption/decryption based on route
 */
export const encryptionMiddleware = (req: Request,  res: Response,  next: NextFunction) => {
  // Apply encryption for POST/PUT/PATCH requests (data being stored)
  if (['POST',  'PUT',  'PATCH'].includes(req.method)) {
    encryptSensitiveFields(req,  res,  () => {
      decryptSensitiveFields(req,  res,  next);
    });
  } else {
    // Apply decryption for GET requests (data being retrieved)
    decryptSensitiveFields(req,  res,  next);
  }
};