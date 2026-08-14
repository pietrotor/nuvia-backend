/**
 * What the panel is told when something changes. Deliberately an invalidation hint and not the entity
 * itself: the reader refetches through the same REST path everyone else uses, so availability keeps a
 * single source of truth, authorization is not re-solved per payload on a connection that lives for
 * hours, and duplicated or out-of-order delivery becomes harmless.
 *
 * It carries no day or professional either. The reader has one visible range at a time and refetching
 * only touches that one, so narrowing the hint would buy nothing while forcing every publisher to know
 * the timezone of the business to name the day the way the reader does.
 */
export enum RealtimeEventType {
  AGENDA_CHANGED = 'agenda.changed',
}

export interface RealtimeEvent {
  /** Bumped when the shape changes, so an old tab can ignore what it cannot read. */
  v: 1;
  type: RealtimeEventType;
  tenantId: string;
  at: string;
}

/**
 * Number of pub/sub channels the whole platform uses. Fixed on purpose: a channel per tenant would tie
 * the subscription count to traffic and force refcounted subscribe/unsubscribe on every connect and
 * disconnect, which is where leaked subscriptions and races come from. With a fixed set every instance
 * subscribes once at boot and routes by tenant in memory, so the count never grows.
 */
export const REALTIME_SHARD_COUNT = 16;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Stable across processes and restarts, which a language hash of a string is not guaranteed to be. */
export const realtimeShardOf = (tenantId: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < tenantId.length; index += 1) {
    hash ^= tenantId.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return (hash >>> 0) % REALTIME_SHARD_COUNT;
};
