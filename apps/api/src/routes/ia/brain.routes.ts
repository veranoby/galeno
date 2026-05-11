/**
 * IA Brain API Routes - TASK-009E
 * API endpoints for IA Brain preference queries
 */

import { Router } from 'express';
import { authMiddleware, requireDoctor } from '../../middleware/auth.js';
import { IABrainService } from '../../services/ia/brain.js';
import { rateLimitIA } from '../../middleware/rateLimit.js';

const router: Router = Router();

// GET /ia/brain/preferences - Get doctor's AI preferences
router.get('/preferences', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;

      const preferences = await IABrainService.getPreferences(doctorId);

      if (!preferences) {
        return res.status(200).json({
          success: true, 
          data: {
            diagnostics: { topCodes: [],  specialties: [] }, 
            medications: { topMeds: [],  preferredDoses: {} }, 
            exams: { topExams: [] }
          }
        });
      }

      res.json({
        success: true, 
        data: preferences
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// GET /ia/brain/summary - Get brain data summary for a doctor
router.get('/summary', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;

      const summary = await IABrainService.getBrainSummary(doctorId);

      if (!summary) {
        return res.status(200).json({
          success: true, 
          data: null
        });
      }

      res.json({
        success: true, 
        data: summary
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// POST /ia/brain/acceptance - Record an acceptance of an AI suggestion
router.post('/acceptance', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;
      const { category, itemId, accepted } = req.body;

      // Validate input
      if (!category || !itemId || accepted === undefined) {
        return res.status(400).json({
          success: false, 
          error: 'Category,  itemId,  and accepted status are required'
        });
      }

      if (!['diagnostic',  'medication',  'exam'].includes(category)) {
        return res.status(400).json({
          success: false, 
          error: 'Invalid category. Must be diagnostic,  medication,  or exam'
        });
      }

      const success = await IABrainService.recordAcceptance(doctorId,  {
        category, 
        itemId, 
        accepted, 
        timestamp: new Date()
      });

      if (!success) {
        return res.status(500).json({
          success: false, 
          error: 'Failed to record acceptance'
        });
      }

      res.json({
        success: true, 
        message: 'Acceptance recorded successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// GET /ia/brain/top-items - Get top items by category
router.get('/top-items/:category',
  authMiddleware,
  requireDoctor,
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;
      const { category } = req.params;

      if (typeof category !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Category must be a string'
        });
      }

      const { limit = 10 } = req.query;

      if (!['diagnostics', 'medications', 'exams'].includes(category)) {
        return res.status(400).json({
          success: false, 
          error: 'Invalid category. Must be diagnostics,  medications,  or exams'
        });
      }

      const topItems = await IABrainService.getTopItems(
        doctorId, 
        category as 'diagnostics' | 'medications' | 'exams', 
        parseInt(limit as string)
      );

      res.json({
        success: true, 
        data: topItems
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// GET /ia/brain/recent-acceptances - Get recent acceptances
router.get('/recent-acceptances', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;
      const { limit = 50 } = req.query;

      const acceptances = await IABrainService.getRecentAcceptances(
        doctorId, 
        parseInt(limit as string)
      );

      res.json({
        success: true, 
        data: acceptances
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// GET /ia/brain/patterns - Get pattern analysis
router.get('/patterns', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;

      const patterns = await IABrainService.analyzePatterns(doctorId);

      if (!patterns) {
        return res.status(200).json({
          success: true, 
          data: null
        });
      }

      res.json({
        success: true, 
        data: patterns
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

// POST /ia/brain/preferences/update - Update a preference directly
router.post('/preferences/update', 
  authMiddleware, 
  requireDoctor, 
  rateLimitIA(),
  async (req,  res) => {
    try {
      const doctorId = (req as any).doctorId;
      const { category, itemId, action, metadata } = req.body;

      // Validate input
      if (!category || !itemId || !action) {
        return res.status(400).json({
          success: false, 
          error: 'Category,  itemId,  and action are required'
        });
      }

      if (!['diagnostics',  'medications',  'exams'].includes(category)) {
        return res.status(400).json({
          success: false, 
          error: 'Invalid category. Must be diagnostics,  medications,  or exams'
        });
      }

      if (!['increment',  'decrement'].includes(action)) {
        return res.status(400).json({
          success: false, 
          error: 'Action must be increment or decrement'
        });
      }

      const success = await IABrainService.updatePreference(doctorId,  {
        category, 
        itemId, 
        action, 
        metadata
      });

      if (!success) {
        return res.status(500).json({
          success: false, 
          error: 'Failed to update preference'
        });
      }

      res.json({
        success: true, 
        message: 'Preference updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false, 
        error: error.message
      });
    }
  }
);

export default router;