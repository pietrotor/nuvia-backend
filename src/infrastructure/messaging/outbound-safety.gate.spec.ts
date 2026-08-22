import {
  OutboundBlockedError,
  OutboundDeferredError,
} from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import { OutboundClass } from '@domain/messaging/ports/messaging.port';
import { OutboundSafetyGate } from './outbound-safety.gate';

class MemoryRedis {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async get(key: string): Promise<string | null> {
    const row = this.store.get(key);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return row.value;
  }

  async set(
    key: string,
    value: string,
    pxFlag?: string,
    ttl?: number,
    nx?: string,
  ): Promise<'OK' | null> {
    if (nx === 'NX' && this.store.has(key)) {
      const current = this.store.get(key);
      if (current && (!current.expiresAt || current.expiresAt > Date.now())) {
        return null;
      }
    }
    const ttlMs = pxFlag === 'PX' && typeof ttl === 'number' ? ttl : 60_000;
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? 0) + 1;
    this.store.set(key, {
      value: String(current),
      expiresAt: Date.now() + 86_400_000,
    });
    return current;
  }

  async expire(): Promise<number> {
    return 1;
  }

  async eval(
    _script: string,
    _num: number,
    key: string,
    token: string,
  ): Promise<number> {
    const current = await this.get(key);
    if (current !== token) return 0;
    this.store.delete(key);
    return 1;
  }
}

describe('OutboundSafetyGate', () => {
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  it('lets only one send hold the lease for the same tenant', async () => {
    const gate = new OutboundSafetyGate(new MemoryRedis() as never);
    const first = await gate.acquire({
      tenantId: tenantA,
      outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
      holdMs: 10_000,
    });
    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
    ).rejects.toBeInstanceOf(OutboundDeferredError);
    await gate.release(first);
  });

  it('lets different tenants send in parallel', async () => {
    const gate = new OutboundSafetyGate(new MemoryRedis() as never);
    const [a, b] = await Promise.all([
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
      gate.acquire({
        tenantId: tenantB,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
    ]);
    expect(a.tenantId).toBe(tenantA);
    expect(b.tenantId).toBe(tenantB);
  });

  it('fails closed for automated notifications when Redis is down', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const gate = new OutboundSafetyGate(redis as never);

    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
    ).rejects.toBeInstanceOf(OutboundDeferredError);
  });

  it('lets a tenant send again after the lease is released', async () => {
    const gate = new OutboundSafetyGate(new MemoryRedis() as never);
    const first = await gate.acquire({
      tenantId: tenantA,
      outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
      holdMs: 10_000,
    });
    await gate.release(first);
    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
    ).resolves.toEqual(expect.objectContaining({ tenantId: tenantA }));
  });

  it('defers the next internal send after a successful accept', async () => {
    const gate = new OutboundSafetyGate(new MemoryRedis() as never);
    const lease = await gate.acquire({
      tenantId: tenantA,
      outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
      holdMs: 10_000,
    });
    await gate.noteSuccess(lease);
    await gate.release(lease);

    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
        holdMs: 10_000,
      }),
    ).rejects.toBeInstanceOf(OutboundDeferredError);
  });

  it('fails open for a manual human reply when Redis is down', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const gate = new OutboundSafetyGate(redis as never);

    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.MANUAL,
        holdMs: 10_000,
      }),
    ).resolves.toEqual(expect.objectContaining({ token: 'manual-ungated' }));
  });

  it('blocks automated outbound after a 463 opens the breaker', async () => {
    const gate = new OutboundSafetyGate(new MemoryRedis() as never);
    await gate.openBreaker(tenantA);

    await expect(
      gate.acquire({
        tenantId: tenantA,
        outboundClass: OutboundClass.AGENT_REPLY,
        holdMs: 10_000,
      }),
    ).rejects.toBeInstanceOf(OutboundBlockedError);
  });
});
