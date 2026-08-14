import { REALTIME_SHARD_COUNT, realtimeShardOf } from './realtime-event';

describe('realtimeShardOf', () => {
  const tenants = Array.from(
    { length: 500 },
    (_, index) => `tenant-${index}-${index * 7}`,
  );

  it('lands inside the fixed set of channels', () => {
    tenants.forEach((tenantId) => {
      const shard = realtimeShardOf(tenantId);

      expect(Number.isInteger(shard)).toBe(true);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(REALTIME_SHARD_COUNT);
    });
  });

  it('sends a tenant to the same channel every time', () => {
    // Publisher and subscriber run in different processes, so an unstable hash would route an event to
    // a channel nobody is listening on.
    expect(realtimeShardOf('estetica-glow')).toBe(
      realtimeShardOf('estetica-glow'),
    );
  });

  it('spreads tenants across the channels instead of piling them on one', () => {
    const used = new Set(tenants.map(realtimeShardOf));

    expect(used.size).toBe(REALTIME_SHARD_COUNT);
  });
});
