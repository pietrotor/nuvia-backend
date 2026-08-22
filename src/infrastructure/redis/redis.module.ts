import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

import {
  REDIS_COMMANDS,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis.constants';

const RECONNECT_CEILING_MS = 5_000;

const baseOptions = (config: ConfigService): RedisOptions => ({
  host: config.get<string>('REDIS_HOST', 'localhost'),
  port: Number(config.get<string>('REDIS_PORT', '6379')),
  retryStrategy: (attempt) => Math.min(attempt * 200, RECONNECT_CEILING_MS),
});

const commandClientFactory = (config: ConfigService): Redis =>
  new Redis({
    ...baseOptions(config),
    enableOfflineQueue: false,
  });

const publisherFactory = (config: ConfigService): Redis =>
  new Redis({
    ...baseOptions(config),
    // Publishing is best-effort: when Redis is down the call must fail right away instead of buffering
    // commands in memory, because nothing downstream is waiting for the result.
    enableOfflineQueue: false,
  });

const subscriberFactory = (config: ConfigService): Redis =>
  new Redis(baseOptions(config));

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_PUBLISHER,
      inject: [ConfigService],
      useFactory: publisherFactory,
    },
    {
      provide: REDIS_SUBSCRIBER,
      inject: [ConfigService],
      useFactory: subscriberFactory,
    },
    {
      provide: REDIS_COMMANDS,
      inject: [ConfigService],
      useFactory: commandClientFactory,
    },
  ],
  exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER, REDIS_COMMANDS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
    @Inject(REDIS_COMMANDS) private readonly commands: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    // An ioredis client keeps the event loop alive until told to quit, which would hang the process.
    await Promise.allSettled([
      this.publisher.quit(),
      this.subscriber.quit(),
      this.commands.quit(),
    ]);
  }
}
