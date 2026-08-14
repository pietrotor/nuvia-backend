import { ClockPort } from '@domain/common/ports/clock.port';
import { RealtimeEventType } from '@domain/realtime/entities/realtime-event';
import { EventBusPort } from '@domain/realtime/ports/event-bus.port';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';
import { AgendaEventPublisher } from './agenda-event.publisher';

describe('AgendaEventPublisher', () => {
  let bus: jest.Mocked<Pick<EventBusPort, 'publish' | 'onEvent'>>;
  let tenantContext: Pick<TenantContextPort, 'tenantId'>;
  let publisher: AgendaEventPublisher;

  const clock: ClockPort = { now: () => new Date('2026-08-05T16:00:00.000Z') };

  beforeEach(() => {
    bus = { publish: jest.fn(), onEvent: jest.fn() };
    tenantContext = { tenantId: 't1' };
    publisher = new AgendaEventPublisher(
      bus as unknown as EventBusPort,
      tenantContext as TenantContextPort,
      clock,
    );
  });

  it('announces the change scoped to the tenant of the operation', async () => {
    await publisher.changed();

    expect(bus.publish).toHaveBeenCalledWith({
      v: 1,
      type: RealtimeEventType.AGENDA_CHANGED,
      tenantId: 't1',
      at: '2026-08-05T16:00:00.000Z',
    });
  });

  it('carries no entity data, only the hint that something moved', async () => {
    await publisher.changed();

    const [event] = bus.publish.mock.calls[0];
    expect(Object.keys(event).sort()).toEqual(['at', 'tenantId', 'type', 'v']);
  });

  it('stays quiet when there is no tenant to notify', async () => {
    tenantContext = { tenantId: null };
    publisher = new AgendaEventPublisher(
      bus as unknown as EventBusPort,
      tenantContext as TenantContextPort,
      clock,
    );

    await publisher.changed();

    expect(bus.publish).not.toHaveBeenCalled();
  });
});
