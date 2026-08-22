import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { AppointmentNotificationDeliverySchema } from '../schema/appointment-notification.schema';

export class AppointmentNotificationDeliveryMapper {
  static toDomain(
    row: AppointmentNotificationDeliverySchema,
  ): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      id: row.id,
      tenantId: row.tenantId,
      eventId: row.eventId,
      contactId: row.contactId,
      destinationPhoneE164: row.destinationPhoneE164,
      renderedContent: row.renderedContent,
      status: row.status as AppointmentNotificationDeliveryStatus,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      leaseUntil: row.leaseUntil,
      providerMessageId: row.providerMessageId,
      acceptedAt: row.acceptedAt,
      deliveredAt: row.deliveredAt,
      failedAt: row.failedAt,
      lastErrorCode: row.lastErrorCode,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
