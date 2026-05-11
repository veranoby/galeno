import { Request, Response } from 'express';
import { LocationService } from '../../services/location/location.service.js';
const locationService = new LocationService();

export class LocationController {
  /**
   * Updates doctor's location with encrypted coordinates
   */
  static async updateLocation(req: Request,  res: Response) {
    try {
      const { doctorId, oficinaId, lat, lng } = req.body;

      if (!doctorId || !oficinaId || typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          error: 'Missing required fields: doctorId,  oficinaId,  lat,  lng', 
          success: false
        });
      }

      // Validate coordinates range
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({
          error: 'Invalid coordinates: latitude must be between -90 and 90,  longitude between -180 and 180', 
          success: false
        });
      }

      const success = await locationService.updateDoctorLocation(doctorId,  oficinaId,  lat,  lng);

      if (success) {
        res.status(200).json({
          message: 'Location updated successfully', 
          success: true
        });
      } else {
        res.status(500).json({
          error: 'Failed to update location', 
          success: false
        });
      }
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }

  /**
   * Gets doctor's current location
   */
  static async getDoctorLocation(req: Request,  res: Response) {
    try {
      const { doctorId } = req.params;

      if (typeof doctorId !== 'string') {
        return res.status(400).json({
          error: 'Doctor ID must be a string',
          success: false
        });
      }

      if (!doctorId) {
        return res.status(400).json({
          error: 'Doctor ID is required',
          success: false
        });
      }

      const location = await locationService.getDoctorLocation(doctorId);

      if (location) {
        res.status(200).json({
          data: location, 
          success: true
        });
      } else {
        res.status(404).json({
          error: 'Location not found or expired', 
          success: false
        });
      }
    } catch (error) {
      console.error('Error getting doctor location:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }

  /**
   * Gets all offices
   */
  static async getAllOffices(req: Request,  res: Response) {
    try {
      const offices = await locationService.getAllOffices();

      res.status(200).json({
        data: offices, 
        success: true
      });
    } catch (error) {
      console.error('Error getting offices:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }

  /**
   * Gets an office by ID
   */
  static async getOfficeById(req: Request,  res: Response) {
    try {
      const { officeId } = req.params;

      if (typeof officeId !== 'string') {
        return res.status(400).json({
          error: 'Office ID must be a string',
          success: false
        });
      }

      if (!officeId) {
        return res.status(400).json({
          error: 'Office ID is required',
          success: false
        });
      }

      const office = await locationService.getOfficeById(officeId);

      if (office) {
        res.status(200).json({
          data: office, 
          success: true
        });
      } else {
        res.status(404).json({
          error: 'Office not found', 
          success: false
        });
      }
    } catch (error) {
      console.error('Error getting office:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }

  /**
   * Gets distance between doctor and office
   */
  static async getDistance(req: Request,  res: Response) {
    try {
      const { doctorId, officeId } = req.params;

      if (typeof doctorId !== 'string' || typeof officeId !== 'string') {
        return res.status(400).json({
          error: 'Doctor ID and Office ID must be strings',
          success: false
        });
      }

      if (!doctorId || !officeId) {
        return res.status(400).json({
          error: 'Doctor ID and Office ID are required',
          success: false
        });
      }

      // Get doctor's coordinates
      const doctorCoords = await locationService.getDecryptedCoordinates(doctorId);
      if (!doctorCoords) {
        return res.status(404).json({
          error: 'Doctor location not found or expired', 
          success: false
        });
      }

      // Get office coordinates
      const office = await locationService.getOfficeById(officeId);
      if (!office) {
        return res.status(404).json({
          error: 'Office not found', 
          success: false
        });
      }

      // Calculate distance
      const distance = locationService.calculateDistance(
        doctorCoords.lat, 
        doctorCoords.lng, 
        office.lat, 
        office.lng
      );

      res.status(200).json({
        data: {
          distance: distance, 
          doctorLocation: doctorCoords, 
          officeLocation: { lat: office.lat,  lng: office.lng }
        }, 
        success: true
      });
    } catch (error) {
      console.error('Error calculating distance:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }

  /**
   * Sets consent for location tracking
   */
  static async setConsent(req: Request,  res: Response) {
    try {
      const { doctorId, activated } = req.body;

      if (!doctorId || typeof activated !== 'boolean') {
        return res.status(400).json({
          error: 'Doctor ID and activation status are required', 
          success: false
        });
      }

      const success = await locationService.setConsent(doctorId,  activated);

      if (success) {
        res.status(200).json({
          message: `Consent ${activated ? 'granted' : 'revoked'} successfully`, 
          success: true
        });
      } else {
        res.status(500).json({
          error: 'Failed to update consent', 
          success: false
        });
      }
    } catch (error) {
      console.error('Error setting consent:', error);
      res.status(500).json({
        error: 'Internal server error', 
        success: false
      });
    }
  }
}