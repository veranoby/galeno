// apps/api/src/events/EventBus.ts
/**
 * EventBus - Bus de Eventos con Redis Pub/Sub
 *
 * Implementa un Event Bus distribuido usando Redis Pub/Sub para:
 * - Comunicación asíncrona entre servicios
 * - Desacoplamiento de módulos
 * - Escalabilidad horizontal
 *
 * Patrones aplicados:
 * - Pub/Sub: Publicación/Suscripción de eventos
 * - Event Bus: Bus central de eventos
 * - Observer: Handlers se suscriben a eventos
 *
 * @example
 * ```typescript
 * // Publicar evento
 * await eventBus.publish({
 *   ...createBaseEvent('PaymentReceived', { userId: 'xxx' }),
 *   data: { pagoId: 'yyy', amount: 100 }
 * });
 *
 * // Suscribirse a eventos
 * eventBus.subscribe('PaymentReceived', async (event) => {
 *   console.log('Pago recibido:', event.data);
 * });
 * ```
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import type { GalenoDomainEvent, DomainEvent } from './DomainEvent.js';

// ============= TYPES =============

export type EventPattern = string | RegExp | ((event: DomainEvent) => boolean);

export type EventHandler<T extends DomainEvent = GalenoDomainEvent> = (
  event: T
) => Promise<void> | void;

export interface EventSubscription {
  id: string;
  pattern: EventPattern;
  handler: EventHandler;
  once: boolean;
}

// ============= EVENT BUS =============

export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private localHandlers: Map<string, EventSubscription[]> = new Map();
  private subscriptionId: string | null = null;
  private isSubscribed = false;

  constructor(publisher: Redis, subscriber?: Redis) {
    this.publisher = publisher;
    this.subscriber = subscriber || publisher.duplicate();
  }

  /**
   * Publica un evento en el bus
   *
   * @param event - Evento a publicar
   * @returns Promise que resuelve cuando se publica
   */
  async publish<T extends GalenoDomainEvent>(event: T): Promise<void> {
    try {
      const channel = `events:${event.eventType}`;
      const message = JSON.stringify(event);

      // Publicar en Redis Pub/Sub
      await this.publisher.publish(channel, message);

      // También ejecutar handlers locales (para mismo proceso)
      await this.executeLocalHandlers(event);

      logger.debug({
        eventType: event.eventType,
        eventId: event.eventId
      }, 'Event published');
    } catch (error) {
      logger.error({ error, event }, 'Error publishing event');
      throw error;
    }
  }

  /**
   * Se suscribe a eventos que coincidan con el patrón
   *
   * @param pattern - Patrón de evento (string, regex, o función)
   * @param handler - Función a ejecutar cuando ocurra el evento
   * @returns ID de suscripción para poder desuscribirse
   */
  subscribe(
    pattern: EventPattern,
    handler: EventHandler,
    options: { once?: boolean } = {}
  ): string {
    const subscriptionId = this.createSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      pattern,
      handler,
      once: options.once || false
    };

    // Agregar handler local
    const patternKey = this.getPatternKey(pattern);
    if (!this.localHandlers.has(patternKey)) {
      this.localHandlers.set(patternKey, []);
    }
    this.localHandlers.get(patternKey)!.push(subscription);

    // Iniciar suscripción Redis si no está iniciada
    if (!this.isSubscribed) {
      this.startRedisSubscription().catch((error) => {
        logger.error({ error }, 'Error starting Redis subscription');
      });
    }

    logger.debug({
      subscriptionId,
      pattern: patternKey
    }, 'Event subscription created');

    return subscriptionId;
  }

  /**
   * Se suscribe a un evento que se ejecuta una sola vez
   */
  once(pattern: EventPattern, handler: EventHandler): string {
    return this.subscribe(pattern, handler, { once: true });
  }

  /**
   * Cancela una suscripción
   *
   * @param subscriptionId - ID de la suscripción a cancelar
   */
  unsubscribe(subscriptionId: string): void {
    for (const [patternKey, subscriptions] of Array.from(this.localHandlers.entries())) {
      const index = subscriptions.findIndex((sub) => sub.id === subscriptionId);
      if (index !== -1) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.localHandlers.delete(patternKey);
        }
        logger.debug({ subscriptionId }, 'Event subscription removed');
        return;
      }
    }
  }

  /**
   * Se suscribe a eventos de múltiples tipos
   */
  subscribeMany(
    patterns: EventPattern[],
    handler: EventHandler,
    options?: { once?: boolean }
  ): string[] {
    return patterns.map((pattern) => this.subscribe(pattern, handler, options));
  }

  /**
   * Publica múltiples eventos en batch
   */
  async publishBatch<T extends GalenoDomainEvent>(events: T[]): Promise<void> {
    const pipeline = this.publisher.pipeline();

    for (const event of events) {
      const channel = `events:${event.eventType}`;
      const message = JSON.stringify(event);
      pipeline.publish(channel, message);
    }

    await pipeline.exec();

    // Ejecutar handlers locales para cada evento
    for (const event of events) {
      await this.executeLocalHandlers(event);
    }

    logger.debug({ count: events.length }, 'Batch events published');
  }

  /**
   * Limpia todas las suscripciones
   */
  async clear(): Promise<void> {
    this.localHandlers.clear();

    if (this.subscriptionId) {
      await this.subscriber.unsubscribe();
      this.subscriptionId = null;
      this.isSubscribed = false;
    }

    logger.info('EventBus cleared');
  }

  /**
   * Cierra las conexiones Redis
   */
  async close(): Promise<void> {
    await this.clear();

    if (this.subscriber !== this.publisher) {
      await this.subscriber.quit();
    }
  }

  // ============= PRIVATE METHODS =============

  /**
   * Inicia la suscripción a Redis
   */
  private async startRedisSubscription(): Promise<void> {
    if (this.isSubscribed) return;

    try {
      // Suscribirse a todos los canales de eventos
      const channels = Array.from(this.localHandlers.keys())
        .map((key) => `events:${key}`);

      if (channels.length > 0) {
        await this.subscriber.subscribe(...channels);

        // Manejar mensajes entrantes
        this.subscriber.on('message', (channel, message) => {
          this.handleRedisMessage(channel, message).catch((error) => {
            logger.error({ error, channel }, 'Error handling Redis message');
          });
        });

        this.isSubscribed = true;
        logger.info('Redis subscription started');
      }
    } catch (error) {
      logger.error({ error }, 'Error starting Redis subscription');
      throw error;
    }
  }

  /**
   * Maneja un mensaje recibido de Redis
   */
  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as GalenoDomainEvent;
      await this.executeLocalHandlers(event);
    } catch (error) {
      logger.error({ error, channel, message }, 'Error parsing Redis message');
    }
  }

  /**
   * Ejecuta los handlers locales que coinciden con el evento
   * Optimizado para ejecutar handlers en paralelo
   */
  private async executeLocalHandlers(event: GalenoDomainEvent): Promise<void> {
    const toRemove: string[] = [];
    const handlerPromises: Promise<void>[] = [];

    for (const [patternKey, subscriptions] of Array.from(this.localHandlers.entries())) {
      for (const subscription of subscriptions) {
        if (this.matchesPattern(event, subscription.pattern)) {
          // Crear promesa para cada handler (ejecutan en paralelo)
          const promise = Promise.resolve(subscription.handler(event))
            .then(() => {
              // Remover suscripción si es once
              if (subscription.once) {
                toRemove.push(subscription.id);
              }
            })
            .catch((error) => {
              logger.error({
                error,
                eventType: event.eventType,
                subscriptionId: subscription.id
              }, 'Error executing event handler');
            });

          handlerPromises.push(promise);
        }
      }
    }

    // Esperar a que todos los handlers terminen (en paralelo)
    await Promise.allSettled(handlerPromises);

    // Remover suscripciones once (fuera del Promise.allSettled para no bloquear)
    for (const id of toRemove) {
      this.unsubscribe(id);
    }
  }

  /**
   * Verifica si un evento coincide con un patrón
   */
  private matchesPattern(event: DomainEvent, pattern: EventPattern): boolean {
    if (typeof pattern === 'string') {
      return event.eventType === pattern;
    }

    if (pattern instanceof RegExp) {
      return pattern.test(event.eventType);
    }

    if (typeof pattern === 'function') {
      try {
        return pattern(event);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Genera una clave única para un patrón
   */
  private getPatternKey(pattern: EventPattern): string {
    if (typeof pattern === 'string') {
      return pattern;
    }
    if (pattern instanceof RegExp) {
      return pattern.source;
    }
    return 'function';
  }

  /**
   * Genera un ID de suscripción único
   */
  private createSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// ============= SINGLETON =============

let eventBusInstance: EventBus | null = null;

/**
 * Obtiene la instancia singleton del EventBus
 */
export function getEventBus(publisher?: Redis, subscriber?: Redis): EventBus {
  if (!eventBusInstance) {
    if (!publisher) {
      throw new Error('Redis client required on first call to getEventBus');
    }
    eventBusInstance = new EventBus(publisher, subscriber);
  }
  return eventBusInstance;
}

/**
 * Resetea el singleton (útil para tests)
 */
export function resetEventBus(): void {
  eventBusInstance = null;
}

export default EventBus;
