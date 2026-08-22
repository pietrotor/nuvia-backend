import { Inject, Injectable } from '@nestjs/common';

import { hashActivationCode } from '../services/activation-code';
import {
  APPOINTMENT_NOTIFICATION_COPY_PORT,
  AppointmentNotificationCopyPort,
} from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  NOTIFICATION_CONTACT_REPOSITORY,
  NotificationContactRepository,
} from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import {
  NotificationCommandKind,
  ParsedNotificationCommand,
} from '@domain/appointment-notifications/value-objects/notification-command.vo';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';

export interface HandleNotificationCommandInput {
  tenantId: string;
  phoneE164: string;
  providerMessageId: string;
  command: ParsedNotificationCommand;
}

@Injectable()
export class HandleNotificationCommandUseCase {
  constructor(
    @Inject(NOTIFICATION_CONTACT_REPOSITORY)
    private readonly contacts: NotificationContactRepository,
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    @Inject(APPOINTMENT_NOTIFICATION_COPY_PORT)
    private readonly copy: AppointmentNotificationCopyPort,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(input: HandleNotificationCommandInput): Promise<boolean> {
    const contact = await this.contacts.findByPhone(input.phoneE164);
    if (!contact) return false;

    const now = this.clock.now();
    if (input.command.kind === NotificationCommandKind.ACTIVATE) {
      if (
        contact.status === NotificationContactStatus.PENDING &&
        contact.activationCodeHash &&
        contact.activationExpiresAt &&
        contact.activationExpiresAt.getTime() >= now.getTime()
      ) {
        const expected = hashActivationCode({
          tenantId: input.tenantId,
          code: input.command.activationCode ?? '',
        });
        if (expected === contact.activationCodeHash) {
          await this.contacts.save(
            contact.activate({
              now,
              providerMessageId: input.providerMessageId,
            }),
          );
          await this.reply(input, NotificationCommandKind.ACTIVATE);
        }
      }
      return true;
    }

    if (contact.status === NotificationContactStatus.DEACTIVATED) {
      return true;
    }

    if (input.command.kind === NotificationCommandKind.PAUSE) {
      if (contact.status === NotificationContactStatus.ACTIVE) {
        await this.contacts.save(contact.pause(now));
        await this.reply(input, NotificationCommandKind.PAUSE);
      }
      return true;
    }
    if (input.command.kind === NotificationCommandKind.RESUME) {
      if (contact.status === NotificationContactStatus.PAUSED) {
        await this.contacts.save(contact.resume(now));
        await this.reply(input, NotificationCommandKind.RESUME);
      }
      return true;
    }

    await this.contacts.save(contact.deactivate(now));
    await this.deliveries.cancelOpenForContact(contact.id, now);
    await this.reply(input, NotificationCommandKind.OPT_OUT);
    return true;
  }

  private async reply(
    input: HandleNotificationCommandInput,
    kind: NotificationCommandKind,
  ): Promise<void> {
    await this.messaging.sendText({
      tenantId: input.tenantId,
      toE164: input.phoneE164,
      text: this.copy.handshakeReply(kind),
      outboundClass: OutboundClass.TRANSACTIONAL,
    });
  }
}
