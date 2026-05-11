/**
 * Cita Reminder Job - TASK-041
 *
 * Envía recordatorios de citas médicas vía WhatsApp y Email:
 * - 24 horas antes (recordatorio diario)
 * - 1 hora antes (recordatorio urgente)
 *
 * Se ejecuta:
 * - Diariamente a las 8 AM para recordatorios de 24h
 * - Cada hora para recordatorios de 1h
 */
import cron from 'node-cron';
import prisma from '../config/database.js';
import { emailService } from '../services/email/email.service.js';
import { getEnhancedNotificationService } from '../services/notifications/enhanced-notification.service.js';
import { getWhatsAppProvider } from '../services/whatsapp/index.js';
import { logger } from '../utils/logger.js';
import { NotificationMethod, NotificationType } from '@galeno/shared-types';

/**
 * Obtiene las citas del día siguiente (24-48 horas en el futuro)
 */
async function obtenerCitasManana() {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(0, 0, 0, 0);

  const finManana = new Date(manana);
  finManana.setHours(23, 59, 59, 999);

  return prisma.cita.findMany({
    where: {
      fechaHora: { gte: manana, lte: finManana },
      estado: { in: ['programada', 'confirmada'] },
      notificadaPaciente: false, // Solo enviar a quienes no han sido notificados
    },
    include: {
      paciente: true,
      doctor: true,
      ubicacion: true,
    },
  });
}

/**
 * Obtiene las citas de la próxima hora (1 hora en el futuro)
 */
async function obtenerCitasProximaHora() {
  const ahora = new Date();
  const dentroUnaHora = new Date(ahora.getTime() + 60 * 60 * 1000);

  return prisma.cita.findMany({
    where: {
      fechaHora: { gte: ahora, lte: dentroUnaHora },
      estado: { in: ['programada', 'confirmada'] },
      notificadaPaciente1h: false, // Solo enviar a quienes no han sido notificados 1h antes
    },
    include: {
      paciente: true,
      doctor: true,
      ubicacion: true,
    },
  });
}

/**
 * Envía recordatorio de cita individual (24h antes)
 */
async function enviarRecordatorio24h(cita: any) {
  try {
    // Formatear fecha y hora para el mensaje
    const fechaHora = cita.fechaHora.toLocaleString('es-EC', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Determinar tipo de cita
    const tipoCita = cita.tipo === 'teleconsulta'
      ? 'teleconsulta'
      : 'presencial';

    // Obtener teléfono del paciente
    const telefono = cita.paciente.telefono;

    if (!telefono) {
      logger.warn(
        { citaId: cita.id, paciente: cita.paciente.nombre },
        'Paciente no tiene teléfono, enviando solo email'
      );
      // Fallback a email
      return enviarRecordatorioEmail(cita, fechaHora, tipoCita);
    }

    // Enviar WhatsApp con fallback automático a push
    const whatsappProvider = getWhatsAppProvider();
    const notificationService = getEnhancedNotificationService(prisma);

    const reminderData = {
      pacienteNombre: cita.paciente.nombre,
      doctorNombre: cita.doctor.nombre,
      fechaHora,
      tipo: tipoCita as 'teleconsulta' | 'presencial',
      ubicacion: cita.ubicacion?.direccion || undefined,
      linkVideo: cita.linkVideo || undefined,
    };

    // Intentar enviar por WhatsApp primero
    const whatsappResult = await whatsappProvider.sendAppointmentReminder24h(
      telefono,
      reminderData
    );

    if (whatsappResult.status === 'failed') {
      logger.warn(
        { citaId: cita.id, messageId: whatsappResult.messageId, error: whatsappResult.error },
        'WhatsApp falló, usando fallback a email'
      );
    }

    // También enviar notificación interna (push/SSE)
    await notificationService.sendNotification({
      userId: cita.paciente.cuentaId,
      title: '🏥 Recordatorio de Cita - Mañana',
      message: `Tienes una cita con ${cita.doctor.nombre} mañana a las ${fechaHora}`,
      type: NotificationType.INFO,
      method: NotificationMethod.WHATSAPP,
      data: {
        citaId: cita.id,
        fechaHora: cita.fechaHora.toISOString(),
        tipo: tipoCita,
        linkVideo: cita.linkVideo,
      },
    });

    // Enviar email como complemento
    await enviarRecordatorioEmail(cita, fechaHora, tipoCita);

    // Marcar cita como notificada
    await prisma.cita.update({
      where: { id: cita.id },
      data: { notificadaPaciente: true },
    });

    logger.info(
      {
        citaId: cita.id,
        paciente: cita.paciente.nombre,
        telefono,
        fechaHora: cita.fechaHora,
        whatsappStatus: whatsappResult.status,
      },
      'Recordatorio de cita 24h enviado'
    );

    return true;
  } catch (error) {
    logger.error(
      {
        citaId: cita.id,
        error,
      },
      'Error al enviar recordatorio de cita 24h'
    );
    return false;
  }
}

/**
 * Envía recordatorio de cita individual (1h antes)
 */
async function enviarRecordatorio1h(cita: any) {
  try {
    // Formatear fecha y hora para el mensaje
    const fechaHora = cita.fechaHora.toLocaleString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Determinar tipo de cita
    const tipoCita = cita.tipo === 'teleconsulta' ? 'teleconsulta' : 'presencial';

    // Obtener teléfono del paciente
    const telefono = cita.paciente.telefono;

    if (!telefono) {
      logger.warn(
        { citaId: cita.id, paciente: cita.paciente.nombre },
        'Paciente no tiene teléfono para recordatorio 1h'
      );
      return false;
    }

    // Enviar WhatsApp urgente con fallback automático
    const whatsappProvider = getWhatsAppProvider();
    const notificationService = getEnhancedNotificationService(prisma);

    const reminderData = {
      pacienteNombre: cita.paciente.nombre,
      doctorNombre: cita.doctor.nombre,
      fechaHora,
      tipo: tipoCita as 'teleconsulta' | 'presencial',
      ubicacion: cita.ubicacion?.direccion || undefined,
      linkVideo: cita.linkVideo || undefined,
    };

    // Enviar recordatorio urgente por WhatsApp
    const whatsappResult = await whatsappProvider.sendAppointmentReminder1h(
      telefono,
      reminderData
    );

    // También enviar notificación interna
    await notificationService.sendNotification({
      userId: cita.paciente.cuentaId,
      title: '⏰ Recordatorio Urgente - Cita en 1 Hora',
      message: `Tu cita con ${cita.doctor.nombre} es en 1 hora`,
      type: NotificationType.WARNING,
      method: NotificationMethod.WHATSAPP,
      data: {
        citaId: cita.id,
        fechaHora: cita.fechaHora.toISOString(),
        tipo: tipoCita,
        linkVideo: cita.linkVideo,
        urgente: true,
      },
    });

    // Marcar cita como notificada 1h antes
    await prisma.cita.update({
      where: { id: cita.id },
      data: { notificadaPaciente1h: true },
    });

    logger.info(
      {
        citaId: cita.id,
        paciente: cita.paciente.nombre,
        telefono,
        fechaHora: cita.fechaHora,
        whatsappStatus: whatsappResult.status,
      },
      'Recordatorio de cita 1h enviado'
    );

    return whatsappResult.status !== 'failed';
  } catch (error) {
    logger.error(
      {
        citaId: cita.id,
        error,
      },
      'Error al enviar recordatorio de cita 1h'
    );
    return false;
  }
}

/**
 * Envía recordatorio por email (fallback o complemento)
 */
async function enviarRecordatorioEmail(cita: any, fechaHora: string, tipoCita: string) {
  try {
    const citaData = {
      pacienteNombre: cita.paciente.nombre,
      doctorNombre: cita.doctor.nombre,
      fechaHora,
      tipo: tipoCita === 'teleconsulta' ? 'Teleconsulta (Videoconferencia)' : 'Presencial',
      linkVideo: cita.linkVideo || undefined,
      ubicacion: cita.ubicacion?.direccion || undefined,
    };

    const resultado = await emailService.sendCitaRecordatorio(citaData);

    if (resultado) {
      logger.info(
        {
          citaId: cita.id,
          paciente: cita.paciente.nombre,
          email: cita.paciente.email,
        },
        'Email de recordatorio enviado'
      );
    }

    return !!resultado;
  } catch (error) {
    logger.error({ citaId: cita.id, error }, 'Error al enviar email de recordatorio');
    return false;
  }
}

/**
 * Job de recordatorio de citas 24h antes
 * Se ejecuta diariamente a las 8 AM
 */
async function citaReminder24hJob() {
  logger.info('🔔 Iniciando job de recordatorio de citas (24h)...');

  try {
    const citas = await obtenerCitasManana();

    if (citas.length === 0) {
      logger.info('No hay citas programadas para mañana');
      return;
    }

    logger.info(`Enviando ${citas.length} recordatorio(s) de cita(s) (24h)...`);

    let exitosos = 0;
    let fallidos = 0;

    for (const cita of citas) {
      const resultado = await enviarRecordatorio24h(cita);
      if (resultado) {
        exitosos++;
      } else {
        fallidos++;
      }
    }

    logger.info(
      {
        total: citas.length,
        exitosos,
        fallidos,
      },
      'Job de recordatorio de citas 24h completado'
    );
  } catch (error) {
    logger.error({ error }, 'Error en job de recordatorio de citas 24h');
  }
}

/**
 * Job de recordatorio de citas 1h antes
 * Se ejecuta cada hora
 */
async function citaReminder1hJob() {
  logger.info('⏰ Iniciando job de recordatorio de citas (1h)...');

  try {
    const citas = await obtenerCitasProximaHora();

    if (citas.length === 0) {
      logger.info('No hay citas en la próxima hora');
      return;
    }

    logger.info(`Enviando ${citas.length} recordatorio(s) de cita(s) urgente(s)...`);

    let exitosos = 0;
    let fallidos = 0;

    for (const cita of citas) {
      const resultado = await enviarRecordatorio1h(cita);
      if (resultado) {
        exitosos++;
      } else {
        fallidos++;
      }
    }

    logger.info(
      {
        total: citas.length,
        exitosos,
        fallidos,
      },
      'Job de recordatorio de citas 1h completado'
    );
  } catch (error) {
    logger.error({ error }, 'Error en job de recordatorio de citas 1h');
  }
}

/**
 * Inicia todos los jobs de recordatorio de citas
 */
export function iniciarCitaReminderJob() {
  // Job 24h: Todos los días a las 8:00 AM
  const job24h = cron.schedule('0 8 * * *', citaReminder24hJob, {
    scheduled: true,
    timezone: 'America/Guayaquil', // Ecuador timezone
  });

  // Job 1h: Cada hora en punto
  const job1h = cron.schedule('0 * * * *', citaReminder1hJob, {
    scheduled: true,
    timezone: 'America/Guayaquil',
  });

  logger.info('✅ Jobs de recordatorio de citas programados:');
  logger.info('   - 24h: Todos los días a las 8:00 AM');
  logger.info('   - 1h: Cada hora en punto');

  return { job24h, job1h };
}

/**
 * Detiene todos los jobs de recordatorio de citas
 */
export function detenerCitaReminderJob(jobs: { job24h: cron.ScheduledTask; job1h: cron.ScheduledTask }) {
  if (jobs.job24h) {
    jobs.job24h.stop();
    logger.info('Job de recordatorio de citas 24h detenido');
  }
  if (jobs.job1h) {
    jobs.job1h.stop();
    logger.info('Job de recordatorio de citas 1h detenido');
  }
}
