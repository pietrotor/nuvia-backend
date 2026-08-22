import { AppointmentNotificationSubscription } from '@domain/appointment-notifications/entities/appointment-notification-subscription.entity';
import { AppointmentNotificationSubscriptionSchema } from '../schema/appointment-notification.schema';

export class AppointmentNotificationSubscriptionMapper {
  static toDomain(
    row: AppointmentNotificationSubscriptionSchema,
  ): AppointmentNotificationSubscription {
    return new AppointmentNotificationSubscription({
      id: row.id,
      tenantId: row.tenantId,
      contactId: row.contactId,
      professionalId: row.professionalId,
      branchId: row.branchId,
      enabledAt: row.enabledAt,
      disabledAt: row.disabledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
