import { Inject, Injectable } from '@nestjs/common';

import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { NotificationPhoneAlreadyRegisteredError } from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import {
  NOTIFICATION_CONTACT_REPOSITORY,
  NotificationContactRepository,
} from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { NOTIFICATION_ACTIVATION_TTL_MS } from '@domain/appointment-notifications/services/notification-limits';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';
import { generateActivationCode, hashActivationCode } from './activation-code';

export interface EnsuredNotificationContact {
  contact: NotificationContact;
  activationCode: string | null;
}

@Injectable()
export class EnsureNotificationContactService {
  constructor(
    @Inject(NOTIFICATION_CONTACT_REPOSITORY)
    private readonly contacts: NotificationContactRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    tenantId: string;
    displayName: string;
    phoneE164: string;
  }): Promise<EnsuredNotificationContact> {
    const existing = await this.contacts.findByPhone(input.phoneE164);
    if (existing) {
      if (
        existing.status === NotificationContactStatus.ACTIVE ||
        existing.status === NotificationContactStatus.PAUSED
      ) {
        const renamed =
          existing.displayName === input.displayName
            ? existing
            : await this.contacts.save(
                existing.withDisplayName(input.displayName),
              );
        return { contact: renamed, activationCode: null };
      }

      const now = this.clock.now();
      const activationCode = generateActivationCode();
      const refreshed = await this.contacts.save(
        existing.withDisplayName(input.displayName.trim()).withFreshActivation({
          activationCodeHash: hashActivationCode({
            tenantId: input.tenantId,
            code: activationCode,
          }),
          activationExpiresAt: new Date(
            now.getTime() + NOTIFICATION_ACTIVATION_TTL_MS,
          ),
        }),
      );
      return { contact: refreshed, activationCode };
    }

    const now = this.clock.now();
    const activationCode = generateActivationCode();
    try {
      const contact = await this.contacts.create({
        displayName: input.displayName.trim(),
        phoneE164: input.phoneE164,
        activationCodeHash: hashActivationCode({
          tenantId: input.tenantId,
          code: activationCode,
        }),
        activationExpiresAt: new Date(
          now.getTime() + NOTIFICATION_ACTIVATION_TTL_MS,
        ),
      });
      return { contact, activationCode };
    } catch (error) {
      if (this.isDuplicate(error)) {
        throw new NotificationPhoneAlreadyRegisteredError();
      }
      throw error;
    }
  }

  private isDuplicate(error: unknown): boolean {
    return (
      error instanceof DomainException &&
      error.code === ErrorCode.DUPLICATE_RECORD
    );
  }
}
