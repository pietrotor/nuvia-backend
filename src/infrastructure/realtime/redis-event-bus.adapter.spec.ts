import { EventEmitter } from 'events';
import { Redis } from 'ioredis';

import { LoggerPort } from '@domain/common/ports/logger.port';
import {
  REALTIME_SHARD_COUNT,
  RealtimeEventType,
} from '@domain/realtime/entities/realtime-event';
import { RedisEventBusAdapter } from './redis-event-bus.adapter';

type RedisStatus = 'wait' | 'connecting' | 'ready';

interface FakeRedis extends EventEmitter {
  status: RedisStatus;
  subscribe: jest.Mock;
  publish: jest.Mock;
}

const fakeRedis = (status: RedisStatus): FakeRedis => {
  const client = new EventEmitter() as FakeRedis;
  client.status = status;
  client.subscribe = jest.fn().mockResolvedValue(REALTIME_SHARD_COUNT);
  client.publish = jest.fn().mockResolvedValue(1);
  return client;
};

const asRedis = (client: FakeRedis): Redis => client as unknown as Redis;

const logger: LoggerPort = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('RedisEventBusAdapter', () => {
  it('subscribes at boot when Redis is already ready', () => {
    const publisher = fakeRedis('ready');
    const subscriber = fakeRedis('ready');
    const bus = new RedisEventBusAdapter(
      asRedis(publisher),
      asRedis(subscriber),
      logger,
    );

    bus.onModuleInit();

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe.mock.calls[0]).toHaveLength(
      REALTIME_SHARD_COUNT,
    );
  });

  it('waits for ready when Redis is still connecting', () => {
    const publisher = fakeRedis('connecting');
    const subscriber = fakeRedis('connecting');
    const bus = new RedisEventBusAdapter(
      asRedis(publisher),
      asRedis(subscriber),
      logger,
    );

    bus.onModuleInit();
    expect(subscriber.subscribe).not.toHaveBeenCalled();

    subscriber.status = 'ready';
    subscriber.emit('ready');

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
  });

  it('hands a published event to handlers subscribed on this process', () => {
    const publisher = fakeRedis('ready');
    const subscriber = fakeRedis('ready');
    const bus = new RedisEventBusAdapter(
      asRedis(publisher),
      asRedis(subscriber),
      logger,
    );
    const handler = jest.fn();

    bus.onModuleInit();
    bus.onEvent(handler);

    const event = {
      v: 1 as const,
      type: RealtimeEventType.AGENDA_CHANGED,
      tenantId: 't1',
      at: '2026-08-24T16:00:00.000Z',
    };
    subscriber.emit('message', 'nuvi:events:0', JSON.stringify(event));

    expect(handler).toHaveBeenCalledWith(event);
  });
});
