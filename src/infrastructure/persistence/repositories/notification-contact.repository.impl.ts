import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { NotificationContactRepository } from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { NotificationContactMapper } from '../drizzle/mappers/notification-contact.mapper';
import { notificationContacts } from '../drizzle/schema/appointment-notification.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleNotificationContactRepository
  extends TenantScopedRepository
  implements NotificationContactRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(contact: {
    displayName: string;
    phoneE164: string;
    activationCodeHash: string;
    activationExpiresAt: Date;
  }): Promise<NotificationContact> {
    try {
      const [row] = await this.insertInto(notificationContacts, {
        displayName: contact.displayName,
        phoneE164: contact.phoneE164,
        status: NotificationContactStatus.PENDING,
        activationCodeHash: contact.activationCodeHash,
        activationExpiresAt: contact.activationExpiresAt,
      });
      return NotificationContactMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(contact: NotificationContact): Promise<NotificationContact> {
    const [row] = await this.updateIn(
      notificationContacts,
      {
        displayName: contact.displayName,
        status: contact.status,
        activationCodeHash: contact.activationCodeHash,
        activationExpiresAt: contact.activationExpiresAt,
        activationProviderMessageId: contact.activationProviderMessageId,
        activatedAt: contact.activatedAt,
        pausedAt: contact.pausedAt,
        deactivatedAt: contact.deactivatedAt,
        lastInboundAt: contact.lastInboundAt,
      },
      eq(notificationContacts.id, contact.id),
    );
    return NotificationContactMapper.toDomain(row);
  }

  async findById(id: string): Promise<NotificationContact | null> {
    const [row] = await this.selectFrom(
      notificationContacts,
      eq(notificationContacts.id, id),
    );
    return row ? NotificationContactMapper.toDomain(row) : null;
  }

  async findByPhone(phoneE164: string): Promise<NotificationContact | null> {
    const [row] = await this.selectFrom(
      notificationContacts,
      eq(notificationContacts.phoneE164, phoneE164),
    );
    return row ? NotificationContactMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<NotificationContact[]> {
    if (ids.length === 0) return [];
    const rows = await this.selectFrom(
      notificationContacts,
      inArray(notificationContacts.id, ids),
    );
    return rows.map(NotificationContactMapper.toDomain);
  }
}
