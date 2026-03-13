// apps/api/src/repositories/prisma/PrismaNotificationRepository.ts
/**
 * Implementación del Repository de Notificaciones con Prisma
 */

import { INotificationRepository, CreateNotificationDTO, UpdateNotificationDTO, NotificationFindOptions } from '../interfaces/INotificationRepository';
import { Notificacion, PrismaClient } from '@prisma/client';

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNotificationDTO): Promise<Notificacion> {
    return await this.prisma.notificacion.create({ data });
  }

  async createMany(data: CreateNotificationDTO[]): Promise<{ count: number }> {
    return await this.prisma.notificacion.createMany({ data, skipDuplicates: true });
  }

  async findMany(options: NotificationFindOptions = {}): Promise<Notificacion[]> {
    const { where, orderBy, limit, offset, include } = options;
    return await this.prisma.notificacion.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
    });
  }

  async findByUser(userId: string, options: Omit<NotificationFindOptions, 'where'> = {}): Promise<Notificacion[]> {
    return this.findMany({
      ...options,
      where: { userId: userId },
    });
  }

  async findUnreadByUser(userId: string, options: Omit<NotificationFindOptions, 'where'> = {}): Promise<Notificacion[]> {
    return this.findMany({
      ...options,
      where: { userId: userId, leido: false },
    });
  }

  async countUnreadByUser(userId: string): Promise<number> {
    return await this.prisma.notificacion.count({
      where: { userId: userId, leido: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notificacion | null> {
    // Verificar que la notificación pertenece al usuario
    const notification = await this.prisma.notificacion.findFirst({
      where: { id, userId: userId },
    });

    if (!notification) return null;

    return await this.prisma.notificacion.update({
      where: { id },
      data: { leido: true },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return await this.prisma.notificacion.updateMany({
      where: { userId: userId, leido: false },
      data: { leido: true },
    });
  }

  async markAllAsReadBefore(userId: string, before: Date): Promise<{ count: number }> {
    return await this.prisma.notificacion.updateMany({
      where: {
        userId: userId,
        leido: false,
        createdAt: { lt: before },
      },
      data: { leido: true },
    });
  }

  async update(id: string, data: UpdateNotificationDTO): Promise<Notificacion> {
    return await this.prisma.notificacion.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Notificacion> {
    return await this.prisma.notificacion.delete({
      where: { id },
    });
  }

  async deleteOldNotifications(userId: string, olderThan: Date): Promise<{ count: number }> {
    return await this.prisma.notificacion.deleteMany({
      where: {
        userId: userId,
        createdAt: { lt: olderThan },
      },
    });
  }

  async deleteAllByUser(userId: string): Promise<{ count: number }> {
    return await this.prisma.notificacion.deleteMany({
      where: { userId: userId },
    });
  }

  async findById(id: string, options: NotificationFindOptions = {}): Promise<Notificacion | null> {
    const { include } = options;
    return await this.prisma.notificacion.findUnique({
      where: { id },
      include,
    });
  }

  async count(options: NotificationFindOptions = {}): Promise<number> {
    const { where } = options;
    return await this.prisma.notificacion.count({ where });
  }
}
