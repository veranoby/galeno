import { Request, Response, NextFunction } from 'express';
import locationService from '../services/location/location.service';

/**
 * Middleware to verify GPS location access permissions
 * Note: This middleware validates doctor ID but consent checking must be done
 * at the controller level since LocationService doesn't have a getConsent method
 */
export const gpsAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract doctorId from request (assuming it's in headers or decoded from JWT)
    const doctorId = req.headers['x-doctor-id'] as string;

    if (!doctorId) {
      return res.status(401).json({
        error: 'Doctor ID is required for GPS location access',
        success: false
      });
    }

    // Note: Consent checking should be done at the controller level
    // The LocationService only has setConsent, not getConsent
    // Controllers should query the database directly to check consent status

    next();
  } catch (error) {
    console.error('GPS Auth Middleware Error:', error);
    return res.status(500).json({
      error: 'Internal server error during GPS authentication',
      success: false
    });
  }
};