import { Inject, Injectable } from '@nestjs/common';

import { ExpandAppointmentNotificationEventUseCase } from './expand-appointment-notification-event.use-case';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
  AppointmentNotificationEventRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { NOTIFICATION_DISPATCH_BATCH_SIZE } from '@domain/appointment-notifications/services/notification-limits';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

export interface AppointmentNotificationDispatchBatch {
  deliveryIds: { tenantId: string; deliveryId: string }[];
}

@Injectable()
export class DispatchAppointmentNotificationsUseCase {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY)
    private readonly events: AppointmentNotificationEventRepository,
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    private readonly expand: ExpandAppointmentNotificationEventUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<AppointmentNotificationDispatchBatch> {
    const now = this.clock.now();
    const dueEvents = await this.events.findUnexpandedDueUnscoped(
      now,
      NOTIFICATION_DISPATCH_BATCH_SIZE,
    );
    for (const event of dueEvents) {
      await this.tenantContext.runWithTenant(event.tenantId, () =>
        this.expand.execute(event.id),
      );
    }

    const dueDeliveries = await this.deliveries.claimDueUnscoped(
      now,
      NOTIFICATION_DISPATCH_BATCH_SIZE,
    );
    return {
      deliveryIds: dueDeliveries.map((delivery) => ({
        tenantId: delivery.tenantId,
        deliveryId: delivery.id,
      })),
    };
  }
}
