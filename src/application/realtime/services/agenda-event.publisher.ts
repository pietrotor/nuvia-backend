import { Inject, Injectable } from '@nestjs/common';

import { RealtimeEventType } from '@domain/realtime/entities/realtime-event';
import {
  EVENT_BUS_PORT,
  EventBusPort,
} from '@domain/realtime/ports/event-bus.port';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

/**
 * Announces that the agenda of the current tenant moved. Sits where `AuditRecorder` sits, at the end of
 * the use case, so booking through WhatsApp, the panel and the public page all announce themselves
 * without any of them knowing this exists.
 */
@Injectable()
export class AgendaEventPublisher {
  constructor(
    @Inject(EVENT_BUS_PORT) private readonly bus: EventBusPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async changed(): Promise<void> {
    const tenantId = this.tenantContext.tenantId;
    // A change outside a tenant scope has nobody to notify.
    if (!tenantId) return;

    await this.bus.publish({
      v: 1,
      type: RealtimeEventType.AGENDA_CHANGED,
      tenantId,
      at: this.clock.now().toISOString(),
    });
  }
}
