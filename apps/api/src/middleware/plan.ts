import { Request, Response, NextFunction } from 'express';
import { PlanValidationService } from '../services/plan/validation.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to validate plan limits before allowing certain actions
 */
export const planValidationMiddleware = (
  action: 'add_doctor' | 'add_assistant' | 'upload_file' | 'access_feature', 
  params?: { count?: number; size?: number; feature?: string }
) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      // Extract user ID from request (assuming it's attached by auth middleware)
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'User authentication required for plan validation'
        });
      }

      // Validate plan before performing the action
      const validationResult = await PlanValidationService.validatePlanBeforeAction(
        userId, 
        action, 
        params
      );

      if (!validationResult.valid) {
        return res.status(403).json({
          error: 'Plan limit exceeded', 
          message: validationResult.error, 
          usage: validationResult.usage
        });
      }

      // If validation passes, continue to the next middleware
      next();
    } catch (error) {
      logger.error({ error: error,  userId: (req as any).user?.id, action }, 'Plan validation middleware error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error validating plan limits'
      });
    }
  };
};

/**
 * Specific middleware for validating storage limits before file uploads
 */
export const storageLimitValidationMiddleware = (maxFileSizeMB: number = 10) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'User authentication required for storage validation'
        });
      }

      // Calculate file size from request
      let fileSize = 0;
      
      // If it's a multipart request (file upload), estimate the size
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // For multipart uploads, we'll check the size in the multer middleware
        // or use the raw body size as an approximation
        fileSize = parseInt(req.headers['content-length'] || '0');
      } else {
        // For other requests, calculate based on body size
        fileSize = Buffer.byteLength(JSON.stringify(req.body));
      }

      // Convert maxFileSizeMB to bytes for comparison
      const maxSizeBytes = maxFileSizeMB * 1024 * 1024;

      // First, validate the individual file size
      if (fileSize > maxSizeBytes) {
        return res.status(400).json({
          error: 'File too large', 
          message: `File exceeds maximum size of ${maxFileSizeMB} MB`
        });
      }

      // Then, validate against the user's remaining storage quota
      const validationResult = await PlanValidationService.validateStorageLimit(userId,  fileSize);

      if (!validationResult.valid) {
        return res.status(403).json({
          error: 'Storage limit exceeded', 
          message: validationResult.error, 
          usage: validationResult.usage
        });
      }

      // If validation passes, continue to the next middleware
      next();
    } catch (error) {
      logger.error({ error: error,  userId: (req as any).user?.id }, 'Storage limit validation middleware error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error validating storage limits'
      });
    }
  };
};

/**
 * Middleware to check if a user has access to a specific feature
 */
export const featureAccessMiddleware = (feature: string) => {
  return async (req: Request,  res: Response,  next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized', 
          message: 'User authentication required for feature access validation'
        });
      }

      const validationResult = await PlanValidationService.validateFeatureAccess(userId,  feature);

      if (!validationResult.valid) {
        return res.status(403).json({
          error: 'Feature not available', 
          message: validationResult.error
        });
      }

      // If validation passes, continue to the next middleware
      next();
    } catch (error) {
      logger.error({ error: error,  userId: (req as any).user?.id, feature }, 'Feature access validation middleware error');
      return res.status(500).json({
        error: 'Internal server error', 
        message: 'Error validating feature access'
      });
    }
  };
};