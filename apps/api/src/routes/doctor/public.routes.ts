// apps/api/src/routes/doctor/public.routes.ts
import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { doctorProfileService } from '../../services/doctor/profile.service.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/doctor/public/:id:
 *   get:
 *     summary: Get doctor public profile by ID
 *     tags: [Doctor Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Doctor profile ID
 *     responses:
 *       200:
 *         description: Doctor public profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DoctorPublicProfile'
 *       404:
 *         description: Profile not found
 */
router.get('/public/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const profile = await doctorProfileService.getProfileById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ error }, 'Error getting doctor profile');
    res.status(500).json({
      success: false,
      error: 'Failed to get doctor profile'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/doctor/:doctorId:
 *   get:
 *     summary: Get doctor public profile by doctor ID
 *     tags: [Doctor Public]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Doctor public profile
 *       404:
 *         description: Profile not found
 */
router.get('/public/doctor/:doctorId', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;

    const profile = await doctorProfileService.getProfileByDoctorId(doctorId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ error }, 'Error getting doctor profile');
    res.status(500).json({
      success: false,
      error: 'Failed to get doctor profile'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/featured:
 *   get:
 *     summary: Get featured doctors
 *     tags: [Doctor Public]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of doctors to return
 *     responses:
 *       200:
 *         description: List of featured doctors
 */
router.get('/public/featured', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const doctors = await doctorProfileService.getFeaturedDoctors(limit);

    res.json({ success: true, data: doctors });
  } catch (error) {
    logger.error({ error }, 'Error getting featured doctors');
    res.status(500).json({
      success: false,
      error: 'Failed to get featured doctors'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/search:
 *   get:
 *     summary: Search doctors
 *     tags: [Doctor Public]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of matching doctors
 */
router.get('/public/search', async (req: Request, res: Response) => {
  try {
    const q = Array.isArray(req.query.q) ? req.query.q[0] : (req.query.q as string);
    const limitQuery = req.query.limit as string;
    const limit = parseInt(limitQuery) || 20;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const doctors = await doctorProfileService.searchDoctors(q as string, parseInt(limitQuery) || 20);

    res.json({ success: true, data: doctors });
  } catch (error) {
    logger.error({ error }, 'Error searching doctors');
    res.status(500).json({
      success: false,
      error: 'Failed to search doctors'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/:doctorId/profile:
 *   put:
 *     summary: Update doctor public profile (authenticated)
 *     tags: [Doctor Public]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               experiencia:
 *                 type: integer
 *               especialidades:
 *                 type: array
 *                 items:
 *                   type: string
 *               ubicacion:
 *                 type: string
 *               precioConsulta:
 *                 type: number
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not the doctor's profile)
 */
router.put('/public/:doctorId/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
    const userId = (req as any).user?.id;

    // Verify user is updating their own profile
    if (userId !== doctorId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
    }

    const profile = await doctorProfileService.updateProfile(doctorId, req.body);

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ error }, 'Error updating doctor profile');
    res.status(500).json({
      success: false,
      error: 'Failed to update doctor profile'
    });
  }
});

// ============= VALORACIONES (BIZ-002) =============

/**
 * @openapi
 * /api/v1/doctor/public/:doctorId/ratings:
 *   get:
 *     summary: Get doctor ratings
 *     tags: [Doctor Ratings]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of ratings
 */
router.get('/public/:doctorId/ratings', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
    const limitQuery = req.query.limit as string;
    const offsetQuery = req.query.offset as string;
    const limit = parseInt(limitQuery) || 20;
    const offset = parseInt(offsetQuery) || 0;

    const result = await doctorProfileService.getRatings(doctorId, { limit, offset });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Error getting ratings');
    res.status(500).json({
      success: false,
      error: 'Failed to get ratings'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/:doctorId/ratings/stats:
 *   get:
 *     summary: Get doctor rating statistics
 *     tags: [Doctor Ratings]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating statistics
 */
router.get('/public/:doctorId/ratings/stats', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;

    const stats = await doctorProfileService.getRatingStats(doctorId);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, 'Error getting rating stats');
    res.status(500).json({
      success: false,
      error: 'Failed to get rating stats'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/public/:doctorId/ratings:
 *   post:
 *     summary: Create rating for a doctor (authenticated)
 *     tags: [Doctor Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comentario:
 *                 type: string
 *               consultaId:
 *                 type: string
 *               anonimizado:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Rating created
 *       400:
 *         description: Invalid rating
 */
router.post('/public/:doctorId/ratings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
    const userId = (req as any).user?.id;
    const { rating, comentario, consultaId, anonimizado } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const result = await doctorProfileService.createRating({
      doctorId,
      pacienteId: userId,
      consultaId,
      rating,
      comentario,
      anonimizado
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ error }, 'Error creating rating');
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create rating'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/ratings/:ratingId/useful:
 *   post:
 *     summary: Mark rating as useful/not useful
 *     tags: [Doctor Ratings]
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - useful
 *             properties:
 *               useful:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rating usefulness updated
 */
router.post('/ratings/:ratingId/useful', async (req: Request, res: Response) => {
  try {
    const ratingId = Array.isArray(req.params.ratingId) ? req.params.ratingId[0] : req.params.ratingId;
    const { useful } = req.body;

    if (typeof useful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'useful must be a boolean'
      });
    }

    const result = await doctorProfileService.markRatingUsefulness(ratingId, useful);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Error marking rating usefulness');
    res.status(500).json({
      success: false,
      error: 'Failed to mark rating usefulness'
    });
  }
});

/**
 * @openapi
 * /api/v1/doctor/ratings/:ratingId/report:
 *   post:
 *     summary: Report inappropriate rating
 *     tags: [Doctor Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating reported
 */
router.post('/ratings/:ratingId/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ratingId = Array.isArray(req.params.ratingId) ? req.params.ratingId[0] : req.params.ratingId;

    const result = await doctorProfileService.reportRating(ratingId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Error reporting rating');
    res.status(500).json({
      success: false,
      error: 'Failed to report rating'
    });
  }
});

export default router;
