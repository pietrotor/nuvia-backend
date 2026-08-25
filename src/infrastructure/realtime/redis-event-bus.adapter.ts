import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  REALTIME_SHARD_COUNT,
  RealtimeEvent,
  realtimeShardOf,
} from '@domain/realtime/entities/realtime-event';
import {
  EventBusPort,
  RealtimeEventHandler,
} from '@domain/realtime/ports/event-bus.port';
import {
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from '@infrastructure/redis/redis.constants';

const CHANNEL_PREFIX = 'nuvi:events';
const CONTEXT = 'RedisEventBus';

const channelOf = (shard: number): string => `${CHANNEL_PREFIX}:${shard}`;

@Injectable()
export class RedisEventBusAdapter implements EventBusPort, OnModuleInit {
  private readonly handlers = new Set<RealtimeEventHandler>();

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  onModuleInit(): void {
    const channels = Array.from({ length: REALTIME_SHARD_COUNT }, (_, shard) =>
      channelOf(shard),
    );

    this.subscriber.on('message', (_channel, payload) => {
      this.dispatch(payload);
    });

    const subscribe = (): void => {
      this.subscriber.subscribe(...channels).catch((error: unknown) => {
        this.logger.error(
          'Could not subscribe to the realtime channels',
          error instanceof Error ? error.stack : undefined,
          CONTEXT,
        );
      });
    };

    // Subscribe on every `ready` so a Redis restart re-attaches the channels. Also subscribe
    // immediately when the client is already ready: Compose waits for Redis before the API
    // starts, so the first `ready` often fires during DI — before this hook — and waiting
    // only for the event would leave the process publishing into empty channels.
    this.subscriber.on('ready', subscribe);
    if (this.subscriber.status === 'ready') subscribe();
  }

  async publish(event: RealtimeEvent): Promise<void> {
    const channel = channelOf(realtimeShardOf(event.tenantId));

    try {
      await this.publisher.publish(channel, JSON.stringify(event));
    } catch (error) {
      // A change that was already committed matters more than the refresh announcing it.
      this.logger.warn(
        `Could not publish ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
        CONTEXT,
      );
    }
  }

  onEvent(handler: RealtimeEventHandler): void {
    this.handlers.add(handler);
  }

  private dispatch(payload: string): void {
    let event: RealtimeEvent;

    try {
      event = JSON.parse(payload) as RealtimeEvent;
    } catch {
      this.logger.warn('Discarded a malformed realtime event', CONTEXT);
      return;
    }

    // Every instance listens to every shard, so most messages belong to tenants it does not serve.
    // Handlers filter by tenant; that is cheap and keeps the subscription count constant.
    this.handlers.forEach((handler) => handler(event));
  }
}
