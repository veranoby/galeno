// apps/api/src/repositories/interfaces/INotificationRepository.ts
/**
 * Interfaz del Repository de Notificaciones
 * Define las operaciones de persistencia para Notificacion
 */

import { Notificacion, Prisma } from '@prisma/client';

export type CreateNotificationDTO = Prisma.NotificacionCreateInput;
export type UpdateNotificationDTO = Prisma.NotificacionUpdateInput;
export type NotificationFindOptions = {
  where?: Prisma.NotificacionWhereInput;
  orderBy?: Prisma.NotificacionOrderByWithRelationInput;
  limit?: number;
  offset?: number;
  include?: Prisma.NotificacionInclude;
};

export interface INotificationRepository {
  /**
   * Crea una nueva notificación
   */
  create(data: CreateNotificationDTO): Promise<Notificacion>;

  /**
   * Crea múltiples notificaciones en una sola transacción
   */
  createMany(data: CreateNotificationDTO[]): Promise<Prisma.BatchPayload>;

  /**
   * Busca notificaciones por criterios
   */
  findMany(options?: NotificationFindOptions): Promise<Notificacion[]>;

  /**
   * Busca notificaciones de un usuario
   */
  findByUser(userId: string, options?: Omit<NotificationFindOptions, 'where'>): Promise<Notificacion[]>;

  /**
   * Busca notificaciones no leídas de un usuario
   */
  findUnreadByUser(userId: string, options?: Omit<NotificationFindOptions, 'where'>): Promise<Notificacion[]>;

  /**
   * Cuenta las notificaciones no leídas de un usuario
   */
  countUnreadByUser(userId: string): Promise<number>;

  /**
   * Marca una notificación como leída
   */
  markAsRead(id: string, userId: string): Promise<Notificacion | null>;

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  markAllAsRead(userId: string): Promise<{ count: number }>;

  /**
   * Marca todas las notificaciones de un usuario como leídas hasta una fecha
   */
  markAllAsReadBefore(userId: string, before: Date): Promise<{ count: number }>;

  /**
   * Actualiza una notificación
   */
  update(id: string, data: UpdateNotificationDTO): Promise<Notificacion>;

  /**
   * Elimina una notificación
   */
  delete(id: string): Promise<Notificacion>;

  /**
   * Elimina notificaciones antiguas de un usuario
   */
  deleteOldNotifications(userId: string, olderThan: Date): Promise<{ count: number }>;

  /**
   * Elimina todas las notificaciones de un usuario
   */
  deleteAllByUser(userId: string): Promise<{ count: number }>;

  /**
   * Busca una notificación por ID
   */
  findById(id: string, options?: NotificationFindOptions): Promise<Notificacion | null>;

  /**
   * Cuenta notificaciones por criterios
   */
  count(options?: NotificationFindOptions): Promise<number>;
}
