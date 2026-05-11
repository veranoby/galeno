import { Router, Request, Response } from 'express';
import { sseRegistry } from '../../services/sse/sse-registry.js';
import { sseManager } from '../../services/sse/sse-manager.js';
import { authMiddleware } from '../../middleware/auth.js';

const router: Router = Router();

/**
 * GET /sse/subscribe
 * Subscribe to Server-Sent Events
 */
router.get('/subscribe',  authMiddleware,  (req: Request,  res: Response) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  // Authenticate that the requesting user matches the userId in the query
  const authenticatedUserId = (req as any).user?.id; // Assuming user info is attached by auth middleware
  if (authenticatedUserId !== userId) {
    res.status(403).json({ error: 'Unauthorized to subscribe to this user\'s events' });
    return;
  }

  // Subscribe the user to SSE
  sseRegistry.subscribe(userId,  res);

  // Log the subscription
  console.log(`User ${userId} subscribed to SSE at ${new Date().toISOString()}`);
});

/**
 * POST /sse/broadcast
 * Broadcast a message to all connected clients
 */
router.post('/broadcast',  authMiddleware,  async (req: Request,  res: Response) => {
  try {
    const { message, type = 'general' } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Create SSE message
    const sseMessage = {
      type,
      data: message,
      timestamp: Date.now()
    };

    // Broadcast via SSE manager (which uses Redis)
    await sseManager.broadcast(sseMessage);
    
    res.status(200).json({ success: true,  message: 'Broadcast sent successfully' });
  } catch (error) {
    console.error('Error broadcasting SSE message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /sse/send-to-user
 * Send a message to a specific user
 */
router.post('/send-to-user',  authMiddleware,  async (req: Request,  res: Response) => {
  try {
    const { userId, message, type = 'general' } = req.body;
    
    if (!userId || !message) {
      res.status(400).json({ error: 'userId and message are required' });
      return;
    }

    // Verify that the authenticated user has permission to send to this user
    const authenticatedUserId = (req as any).user?.id;
    // In a real implementation, you might have more sophisticated permission checks
    // For now, we'll allow a user to send to themselves or check admin status
    
    const isAdmin = (req as any).user?.role === 'admin';
    if (authenticatedUserId !== userId && !isAdmin) {
      res.status(403).json({ error: 'Unauthorized to send message to this user' });
      return;
    }

    // Create SSE message
    const sseMessage = {
      type,
      data: message,
      timestamp: Date.now()
    };

    // Send to specific user via SSE manager (which uses Redis)
    await sseManager.sendToUser(userId,  sseMessage);
    
    res.status(200).json({ success: true,  message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending SSE message to user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /sse/status
 * Get SSE connection status
 */
router.get('/status',  authMiddleware,  (req: Request,  res: Response) => {
  const activeConnections = sseRegistry.getActiveConnections();
  const connectedUsers = sseRegistry.getConnectedUsers();
  
  res.status(200).json({
    activeConnections, 
    connectedUsers, 
    timestamp: new Date().toISOString()
  });
});

export default router;