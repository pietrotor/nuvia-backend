import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import { RealtimeEvent } from '@domain/realtime/entities/realtime-event';
import {
  EVENT_BUS_PORT,
  EventBusPort,
} from '@domain/realtime/ports/event-bus.port';

/**
 * Below every common proxy idle timeout, so the connection never looks idle from the outside. Written as
 * a comment frame, which the SSE protocol tells clients to ignore.
 */
const HEARTBEAT_INTERVAL_MS = 25_000;
const HEARTBEAT_FRAME = ':hb\n\n';

/** How long a socket may stay unable to accept writes before the reader is considered gone. */
const SATURATION_LIMIT_MS = 30_000;

const CONTEXT = 'SseConnectionRegistry';

interface SseConnection {
  tenantId: string;
  response: Response;
  /** Set while the socket buffer is full, so a reader that never drains cannot grow memory forever. */
  saturatedSince: number | null;
}

/**
 * Holds the open streams of this process and writes to the ones the event belongs to. Every instance
 * receives every shard from the bus, so filtering by tenant here is what enforces isolation.
 */
@Injectable()
export class SseConnectionRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly connections = new Set<SseConnection>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    @Inject(EVENT_BUS_PORT) private readonly bus: EventBusPort,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  onModuleInit(): void {
    this.bus.onEvent((event) => this.broadcast(event));

    // One shared timer for every connection. A `setInterval` per client would mean a thousand timers at
    // a thousand readers, and `unref` keeps it from holding the process open on shutdown.
    this.heartbeat = setInterval(() => {
      this.connections.forEach((connection) =>
        this.write(connection, HEARTBEAT_FRAME),
      );
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();
  }

  onModuleDestroy(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.connections.forEach((connection) => connection.response.end());
    this.connections.clear();
  }

  /** Number of streams this process is holding. Exposed for observability and tests. */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Turns the request into an event stream that stays open until the client goes away.
   *
   * @param tenantId Comes from the verified token, never from the request, and scopes everything the
   *   connection will ever receive.
   */
  open(tenantId: string, request: Request, response: Response): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      // `no-transform` also asks intermediaries not to compress, which would buffer the stream.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Without this nginx buffers the whole response and events only arrive when it closes.
      'X-Accel-Buffering': 'no',
    });
    // Otherwise nothing reaches the client until the first event, which may be minutes away.
    response.flushHeaders();

    // Node's own idle timer would close a perfectly healthy stream between heartbeats.
    request.socket.setTimeout(0);

    const connection: SseConnection = {
      tenantId,
      response,
      saturatedSince: null,
    };
    this.connections.add(connection);

    response.on('drain', () => {
      connection.saturatedSince = null;
    });

    request.on('close', () => {
      this.connections.delete(connection);
    });

    // Opens the stream so a client waiting on first bytes stops waiting.
    this.write(connection, ':ok\n\n');
  }

  private broadcast(event: RealtimeEvent): void {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

    this.connections.forEach((connection) => {
      if (connection.tenantId !== event.tenantId) return;
      this.write(connection, frame);
    });
  }

  private write(connection: SseConnection, frame: string): void {
    if (connection.response.writableEnded) {
      this.connections.delete(connection);
      return;
    }

    if (connection.response.write(frame)) {
      connection.saturatedSince = null;
      return;
    }

    if (connection.saturatedSince === null) {
      connection.saturatedSince = Date.now();
      return;
    }

    if (Date.now() - connection.saturatedSince > SATURATION_LIMIT_MS) {
      this.logger.warn('Dropped a stream that stopped reading', CONTEXT);
      this.connections.delete(connection);
      connection.response.destroy();
    }
  }
}
