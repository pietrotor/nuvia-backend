import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  DEFAULT_DAILY_OUTBOUND_CAP,
  DEFAULT_INTERNAL_DAILY_CAP,
  DEFAULT_INTERNAL_HOURLY_CAP,
  INTERNAL_OUTBOUND_GAP_MAX_MS,
  INTERNAL_OUTBOUND_GAP_MEDIAN_MS,
  INTERNAL_OUTBOUND_GAP_MIN_MS,
  OUTBOUND_CAP_DIGEST_RATIO,
} from '@domain/appointment-notifications/services/notification-limits';
import {
  OutboundBlockedError,
  OutboundDeferredError,
} from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import {
  OutboundSafetyPort,
  OutboundSafetySnapshot,
} from '@domain/messaging/ports/outbound-safety.port';
import { OutboundClass } from '@domain/messaging/ports/messaging.port';
import { REDIS_COMMANDS } from '@infrastructure/redis/redis.constants';

const LEASE_WAIT_MS = 60_000;
const LEASE_POLL_MS = 150;
const MANUAL_MIN_GAP_MS = 1_200;
const RELEASE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export interface OutboundLease {
  tenantId: string;
  token: string;
  outboundClass: OutboundClass;
}

@Injectable()
export class OutboundSafetyGate implements OutboundSafetyPort {
  constructor(@Inject(REDIS_COMMANDS) private readonly redis: Redis) {}

  async snapshot(tenantId: string): Promise<OutboundSafetySnapshot> {
    try {
      const [breaker, internalDay] = await Promise.all([
        this.redis.get(this.breakerKey(tenantId)),
        this.redis.get(this.counterKey(tenantId, 'internal', 'day')),
      ]);
      const used = Number(internalDay ?? 0);
      return {
        breakerOpen: breaker === '1',
        internalBudgetDegraded:
          used >= DEFAULT_INTERNAL_DAILY_CAP * OUTBOUND_CAP_DIGEST_RATIO,
      };
    } catch {
      return { breakerOpen: true, internalBudgetDegraded: true };
    }
  }

  async openBreaker(tenantId: string): Promise<void> {
    await this.redis.set(this.breakerKey(tenantId), '1');
  }

  async acquire(input: {
    tenantId: string;
    outboundClass: OutboundClass;
    holdMs: number;
  }): Promise<OutboundLease> {
    const { tenantId, outboundClass, holdMs } = input;
    if (outboundClass === OutboundClass.MANUAL) {
      try {
        const lease = await this.tryLock(tenantId, holdMs);
        if (lease) return { tenantId, token: lease, outboundClass };
        return this.waitForLock(tenantId, outboundClass, holdMs);
      } catch (error) {
        if (error instanceof OutboundDeferredError) throw error;
        return { tenantId, token: 'manual-ungated', outboundClass };
      }
    }

    try {
      const breaker = await this.redis.get(this.breakerKey(tenantId));
      if (breaker === '1') throw new OutboundBlockedError();

      const retryAfter = await this.budgetRetryAfterMs(tenantId, outboundClass);
      if (retryAfter > 0) {
        if (outboundClass === OutboundClass.INTERNAL_NOTIFICATION) {
          throw new OutboundDeferredError(retryAfter);
        }
        await sleep(Math.min(retryAfter, LEASE_WAIT_MS));
      }

      if (outboundClass === OutboundClass.INTERNAL_NOTIFICATION) {
        const token = await this.tryLock(tenantId, holdMs);
        if (!token)
          throw new OutboundDeferredError(INTERNAL_OUTBOUND_GAP_MIN_MS);
        return { tenantId, token, outboundClass };
      }

      return this.waitForLock(tenantId, outboundClass, holdMs);
    } catch (error) {
      if (
        error instanceof OutboundBlockedError ||
        error instanceof OutboundDeferredError
      ) {
        throw error;
      }
      throw new OutboundDeferredError(INTERNAL_OUTBOUND_GAP_MEDIAN_MS);
    }
  }

  async release(lease: OutboundLease): Promise<void> {
    try {
      await this.redis.eval(
        RELEASE_LUA,
        1,
        this.leaseKey(lease.tenantId),
        lease.token,
      );
    } catch {
      // Lease TTL covers a crashed holder; a failed release must not throw.
    }
  }

  async noteSuccess(lease: OutboundLease): Promise<void> {
    const gapMs =
      lease.outboundClass === OutboundClass.INTERNAL_NOTIFICATION
        ? sampleInternalGapMs()
        : MANUAL_MIN_GAP_MS;
    const nextAllowedAt = Date.now() + gapMs;
    try {
      await Promise.all([
        this.redis.set(
          this.nextAllowedKey(lease.tenantId),
          String(nextAllowedAt),
          'PX',
          Math.max(gapMs * 2, 60_000),
        ),
        this.incrementCounter(lease.tenantId, 'all', 'hour', 2 * 60 * 60),
        this.incrementCounter(lease.tenantId, 'all', 'day', 48 * 60 * 60),
        lease.outboundClass === OutboundClass.INTERNAL_NOTIFICATION
          ? this.incrementCounter(
              lease.tenantId,
              'internal',
              'hour',
              2 * 60 * 60,
            )
          : Promise.resolve(0),
        lease.outboundClass === OutboundClass.INTERNAL_NOTIFICATION
          ? this.incrementCounter(
              lease.tenantId,
              'internal',
              'day',
              48 * 60 * 60,
            )
          : Promise.resolve(0),
      ]);
    } catch {
      // Counters are best-effort after a successful provider accept.
    }
  }

  async noteProviderError(tenantId: string, error: unknown): Promise<void> {
    if (!isWhatsApp463(error)) return;
    try {
      await this.openBreaker(tenantId);
    } catch {
      // Fail-closed next acquire if Redis is already unhealthy.
    }
  }

  private async waitForLock(
    tenantId: string,
    outboundClass: OutboundClass,
    holdMs: number,
  ): Promise<OutboundLease> {
    const deadline = Date.now() + LEASE_WAIT_MS;
    while (Date.now() < deadline) {
      const nextAllowed = await this.readNextAllowedAt(tenantId);
      if (nextAllowed > Date.now()) {
        await sleep(Math.min(nextAllowed - Date.now(), LEASE_POLL_MS * 4));
        continue;
      }
      const token = await this.tryLock(tenantId, holdMs);
      if (token) return { tenantId, token, outboundClass };
      await sleep(LEASE_POLL_MS);
    }
    throw new OutboundDeferredError(INTERNAL_OUTBOUND_GAP_MIN_MS);
  }

  private async tryLock(
    tenantId: string,
    holdMs: number,
  ): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(
      this.leaseKey(tenantId),
      token,
      'PX',
      Math.max(holdMs, 5_000),
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  private async budgetRetryAfterMs(
    tenantId: string,
    outboundClass: OutboundClass,
  ): Promise<number> {
    const nextAllowed = await this.readNextAllowedAt(tenantId);
    if (nextAllowed > Date.now()) return nextAllowed - Date.now();

    const [allDay, internalDay, internalHour] = await Promise.all([
      this.readCounter(tenantId, 'all', 'day'),
      this.readCounter(tenantId, 'internal', 'day'),
      this.readCounter(tenantId, 'internal', 'hour'),
    ]);
    if (allDay >= DEFAULT_DAILY_OUTBOUND_CAP) return msUntilNextUtcHour();
    if (outboundClass !== OutboundClass.INTERNAL_NOTIFICATION) return 0;
    if (
      internalDay >= DEFAULT_INTERNAL_DAILY_CAP ||
      internalHour >= DEFAULT_INTERNAL_HOURLY_CAP
    ) {
      return msUntilNextUtcHour();
    }
    return 0;
  }

  private async readNextAllowedAt(tenantId: string): Promise<number> {
    const raw = await this.redis.get(this.nextAllowedKey(tenantId));
    return raw ? Number(raw) : 0;
  }

  private async readCounter(
    tenantId: string,
    kind: 'all' | 'internal',
    window: 'hour' | 'day',
  ): Promise<number> {
    return Number(
      (await this.redis.get(this.counterKey(tenantId, kind, window))) ?? 0,
    );
  }

  private async incrementCounter(
    tenantId: string,
    kind: 'all' | 'internal',
    window: 'hour' | 'day',
    ttlSeconds: number,
  ): Promise<number> {
    const key = this.counterKey(tenantId, kind, window);
    const value = await this.redis.incr(key);
    if (value === 1) await this.redis.expire(key, ttlSeconds);
    return value;
  }

  private leaseKey(tenantId: string): string {
    return `nuvi:outbound:${tenantId}:lease`;
  }

  private nextAllowedKey(tenantId: string): string {
    return `nuvi:outbound:${tenantId}:next`;
  }

  private breakerKey(tenantId: string): string {
    return `nuvi:outbound:${tenantId}:breaker`;
  }

  private counterKey(
    tenantId: string,
    kind: 'all' | 'internal',
    window: 'hour' | 'day',
  ): string {
    const now = new Date();
    const stamp =
      window === 'hour'
        ? now.toISOString().slice(0, 13)
        : now.toISOString().slice(0, 10);
    return `nuvi:outbound:${tenantId}:${kind}:${window}:${stamp}`;
  }
}

function sampleInternalGapMs(): number {
  const mu = Math.log(INTERNAL_OUTBOUND_GAP_MEDIAN_MS);
  const sigma = 0.35;
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sample = Math.exp(mu + sigma * z);
  return Math.min(
    INTERNAL_OUTBOUND_GAP_MAX_MS,
    Math.max(INTERNAL_OUTBOUND_GAP_MIN_MS, Math.round(sample)),
  );
}

function msUntilNextUtcHour(): number {
  const now = Date.now();
  return 60 * 60 * 1000 - (now % (60 * 60 * 1000));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWhatsApp463(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    params?: Record<string, unknown>;
    message?: string;
  };
  const status = Number(candidate.params?.status ?? 0);
  const body = String(candidate.params?.body ?? '');
  const message = String(candidate.message ?? '');
  return status === 463 || /\b463\b/.test(body) || /\b463\b/.test(message);
}
