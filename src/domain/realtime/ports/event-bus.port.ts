import { RealtimeEvent } from '../entities/realtime-event';

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

/**
 * Carries events between processes so any instance can reach a reader connected to any other one.
 * Delivery is at-most-once by design (see `docs/plans/realtime-agenda-sse.md`): a lost event means a
 * stale card until the next one, never a wrong booking, because availability is re-checked server side.
 */
export interface EventBusPort {
  /** Best-effort: a failure here must never roll back the change that produced the event. */
  publish(event: RealtimeEvent): Promise<void>;
  /** Called once per process. Every subsequent handler shares the same subscription. */
  onEvent(handler: RealtimeEventHandler): void;
}

export const EVENT_BUS_PORT = 'EventBusPort';
