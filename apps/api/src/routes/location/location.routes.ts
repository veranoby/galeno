import { Router, Request, Response } from 'express';
import { LocationService } from '../../services/location/location.service.js';
import { gpsAuthMiddleware } from '../../middleware/gps-auth.middleware.js';
import { authMiddleware } from '../../middleware/auth.js';
import { AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();
const locationService = new LocationService();

/**
 * @openapi
 * /location/update:
 *   post:
 *     summary: Update doctor's location
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctorId:
 *                 type: string
 *               oficinaId:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated successfully
 */
router.post('/update', gpsAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { doctorId, oficinaId, lat, lng } = req.body;

    if (!doctorId || !oficinaId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        error: 'Missing required fields: doctorId, oficinaId, lat, lng',
        success: false
      });
    }

    // Validate coordinates range
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
        success: false
      });
    }

    const success = await locationService.updateDoctorLocation(doctorId, oficinaId, lat, lng);

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
    logger.error({ error }, 'Error updating location');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/offices:
 *   get:
 *     summary: Get all offices
 *     tags: [Location]
 *     responses:
 *       200:
 *         description: List of offices
 */
router.get('/offices', async (req: Request, res: Response) => {
  try {
    const offices = await locationService.getAllOffices();

    res.status(200).json({
      data: offices,
      success: true
    });
  } catch (error) {
    logger.error({ error }, 'Error getting offices');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/offices/{officeId}:
 *   get:
 *     summary: Get office by ID
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: officeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Office details
 */
router.get('/offices/:officeId', async (req: Request, res: Response) => {
  try {
    const officeId = Array.isArray(req.params.officeId) ? req.params.officeId[0] : req.params.officeId;

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
    logger.error({ error }, 'Error getting office');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/distance/{doctorId}/{officeId}:
 *   get:
 *     summary: Get distance between doctor and office
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: officeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Distance in kilometers
 */
router.get('/distance/:doctorId/:officeId', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
    const officeId = Array.isArray(req.params.officeId) ? req.params.officeId[0] : req.params.officeId;

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

    // Calculate distance using Haversine formula
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
        officeLocation: { lat: office.lat, lng: office.lng }
      },
      success: true
    });
  } catch (error) {
    logger.error({ error }, 'Error calculating distance');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/consent:
 *   post:
 *     summary: Set consent for location tracking
 *     tags: [Location]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctorId:
 *                 type: string
 *               activated:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Consent updated
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const { doctorId, activated } = req.body;

    if (!doctorId || typeof activated !== 'boolean') {
      return res.status(400).json({
        error: 'Doctor ID and activation status are required',
        success: false
      });
    }

    const success = await locationService.setConsent(doctorId, activated);

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
    logger.error({ error }, 'Error setting consent');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/nearby-doctors:
 *   post:
 *     summary: Find nearby doctors
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientLat
 *               - patientLng
 *             properties:
 *               patientLat:
 *                 type: number
 *               patientLng:
 *                 type: number
 *               radiusKm:
 *                 type: number
 *                 default: 10
 *               especialidad:
 *                 type: string
 *     responses:
 *       200:
 *         description: List of nearby doctors sorted by distance
 */
router.post('/nearby-doctors', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientLat, patientLng, radiusKm = 10, especialidad } = req.body;

    // Validate coordinates
    if (
      typeof patientLat !== 'number' ||
      typeof patientLng !== 'number' ||
      Math.abs(patientLat) > 90 ||
      Math.abs(patientLng) > 180
    ) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        success: false
      });
    }

    const results = await locationService.findNearbyDoctors({
      patientLat,
      patientLng,
      radiusKm,
      especialidad
    });

    res.status(200).json({
      data: results,
      success: true
    });
  } catch (error) {
    logger.error({ error }, 'Error finding nearby doctors');
    res.status(500).json({
      error: 'Failed to find nearby doctors',
      success: false
    });
  }
});

/**
 * @openapi
 * /location/{doctorId}:
 *   get:
 *     summary: Get doctor's location
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctor's location
 */
router.get('/:doctorId', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;

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
    logger.error({ error }, 'Error getting doctor location');
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
});

export default router;
