import { EventEmitter } from 'events';

import type { Request, Response } from 'express';

import { LoggerPort } from '@domain/common/ports/logger.port';
import {
  RealtimeEvent,
  RealtimeEventType,
} from '@domain/realtime/entities/realtime-event';
import {
  EventBusPort,
  RealtimeEventHandler,
} from '@domain/realtime/ports/event-bus.port';
import { SseConnectionRegistry } from './sse-connection.registry';

interface FakeResponse extends EventEmitter {
  frames: string[];
  accepts: boolean;
  writableEnded: boolean;
  writeHead: jest.Mock;
  flushHeaders: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
  destroy: jest.Mock;
}

const fakeResponse = (): FakeResponse => {
  const response = new EventEmitter() as FakeResponse;

  response.frames = [];
  response.accepts = true;
  response.writableEnded = false;
  response.writeHead = jest.fn();
  response.flushHeaders = jest.fn();
  response.write = jest.fn((frame: string) => {
    response.frames.push(frame);
    return response.accepts;
  });
  response.end = jest.fn();
  response.destroy = jest.fn();

  return response;
};

const fakeRequest = (): EventEmitter & {
  socket: { setTimeout: jest.Mock };
} => {
  const request = new EventEmitter() as EventEmitter & {
    socket: { setTimeout: jest.Mock };
  };
  request.socket = { setTimeout: jest.fn() };

  return request;
};

const eventFor = (tenantId: string): RealtimeEvent => ({
  v: 1,
  type: RealtimeEventType.AGENDA_CHANGED,
  tenantId,
  at: '2026-08-05T16:00:00.000Z',
});

const dataFrames = (response: FakeResponse): string[] =>
  response.frames.filter((frame) => frame.startsWith('event:'));

describe('SseConnectionRegistry', () => {
  let registry: SseConnectionRegistry;
  let emit: RealtimeEventHandler;
  let logger: jest.Mocked<Pick<LoggerPort, 'warn' | 'error'>>;

  const open = (tenantId: string) => {
    const request = fakeRequest();
    const response = fakeResponse();

    registry.open(
      tenantId,
      request as unknown as Request,
      response as unknown as Response,
    );

    return { request, response };
  };

  beforeEach(() => {
    const bus: Pick<EventBusPort, 'onEvent' | 'publish'> = {
      onEvent: (handler) => {
        emit = handler;
      },
      publish: jest.fn(),
    };
    logger = { warn: jest.fn(), error: jest.fn() };

    registry = new SseConnectionRegistry(
      bus as EventBusPort,
      logger as unknown as LoggerPort,
    );
    registry.onModuleInit();
  });

  afterEach(() => {
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('opens the stream with headers that survive proxies and no buffering', () => {
    const { response } = open('t1');

    const [, headers] = response.writeHead.mock.calls[0] as [
      number,
      Record<string, string>,
    ];
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['X-Accel-Buffering']).toBe('no');
    expect(headers['Cache-Control']).toContain('no-transform');
    expect(response.flushHeaders).toHaveBeenCalled();
  });

  it('disables the socket idle timer so a quiet stream is not closed', () => {
    const { request } = open('t1');

    expect(request.socket.setTimeout).toHaveBeenCalledWith(0);
  });

  it('delivers the event only to the streams of that tenant', () => {
    const mine = open('t1');
    const other = open('t2');

    emit(eventFor('t1'));

    expect(dataFrames(mine.response)).toHaveLength(1);
    expect(dataFrames(mine.response)[0]).toContain(
      RealtimeEventType.AGENDA_CHANGED,
    );
    expect(dataFrames(other.response)).toHaveLength(0);
  });

  it('forgets a stream once the client goes away', () => {
    const { request, response } = open('t1');
    expect(registry.size).toBe(1);

    request.emit('close');
    expect(registry.size).toBe(0);

    emit(eventFor('t1'));
    expect(dataFrames(response)).toHaveLength(0);
  });

  it('drops a reader that stopped draining instead of buffering forever', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-05T16:00:00.000Z'));

    const { response } = open('t1');
    response.accepts = false;

    emit(eventFor('t1'));
    expect(response.destroy).not.toHaveBeenCalled();

    jest.setSystemTime(new Date('2026-08-05T16:01:00.000Z'));
    emit(eventFor('t1'));

    expect(response.destroy).toHaveBeenCalled();
    expect(registry.size).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps a reader that catches up after draining', () => {
    const { response } = open('t1');

    response.accepts = false;
    emit(eventFor('t1'));

    response.accepts = true;
    response.emit('drain');
    emit(eventFor('t1'));

    expect(response.destroy).not.toHaveBeenCalled();
    expect(registry.size).toBe(1);
  });
});
