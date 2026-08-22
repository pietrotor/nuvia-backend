import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { NotificationContactSchema } from '../schema/appointment-notification.schema';

export class NotificationContactMapper {
  static toDomain(row: NotificationContactSchema): NotificationContact {
    return new NotificationContact({
      id: row.id,
      tenantId: row.tenantId,
      displayName: row.displayName,
      phoneE164: row.phoneE164,
      status: row.status as NotificationContactStatus,
      activationCodeHash: row.activationCodeHash,
      activationExpiresAt: row.activationExpiresAt,
      activationProviderMessageId: row.activationProviderMessageId,
      activatedAt: row.activatedAt,
      pausedAt: row.pausedAt,
      deactivatedAt: row.deactivatedAt,
      lastInboundAt: row.lastInboundAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
