// apps/api/src/routes/v1/whatsapp-webhook.routes.ts
import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';

const router: Router = Router();

/**
 * POST /api/v1/whatsapp/webhook
 * Recibe actualizaciones de estado de mensajes de Twilio
 */
router.post('/webhook', async (req,  res) => {
  try {
    // Twilio envía datos en x-www-form-urlencoded
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

    logger.info({
      event: 'whatsapp_webhook_received',
      messageSid: MessageSid,
      status: MessageStatus,
      to: To
    }, 'WhatsApp webhook received');

    if (!MessageSid) {
      return res.status(400).send('Missing MessageSid');
    }

    // Buscar la notificación que coincida con este whatsappSid en el campo JSON datos
    // Nota: PostgreSQL soporta búsqueda en JSONB
    const notification = await prisma.notificacion.findFirst({
      where: {
        datos: {
          path: ['whatsappSid'],
          equals: MessageSid
        }
      }
    });

    if (notification) {
      // Actualizar estado en la notificación
      const currentData = (notification.datos || {}) as any;
      await prisma.notificacion.update({
        where: { id: notification.id },
        data: {
          datos: {
            ...currentData,
            whatsappStatus: MessageStatus,
            whatsappErrorCode: ErrorCode,
            updatedAt: new Date().toISOString()
          }
        }
      });

      logger.debug({
        event: 'notification_status_updated',
        notificationId: notification.id,
        status: MessageStatus
      });
    }

    // Responder 200 OK a Twilio para evitar reintentos
    res.status(200).send('OK');
  } catch (error: any) {
    logger.error({
      event: 'whatsapp_webhook_error',
      error: error.message
    }, 'Error processing WhatsApp webhook');
    
    // Aun en caso de error interno, respondemos 200 para que Twilio no siga enviando el mismo mensaje
    res.status(200).send('Error but handled');
  }
});

export default router;
