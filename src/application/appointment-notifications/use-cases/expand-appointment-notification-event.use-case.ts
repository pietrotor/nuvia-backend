import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
  AppointmentNotificationEventRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import {
  NOTIFICATION_CONTACT_REPOSITORY,
  NotificationContactRepository,
} from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { resolveNotificationRecipients } from '@domain/appointment-notifications/services/resolve-notification-recipients';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TRANSACTION_PORT,
  TransactionPort,
} from '@domain/common/ports/transaction.port';

@Injectable()
export class ExpandAppointmentNotificationEventUseCase {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY)
    private readonly events: AppointmentNotificationEventRepository,
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    @Inject(NOTIFICATION_CONTACT_REPOSITORY)
    private readonly contacts: NotificationContactRepository,
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(TRANSACTION_PORT)
    private readonly transactions: TransactionPort,
  ) {}

  async execute(eventId: string): Promise<number> {
    const event = await this.events.findById(eventId);
    if (!event || event.expandedAt) return 0;

    const later = await this.events.findLaterForAppointment({
      appointmentId: event.appointmentId,
      afterSequence: event.sequence,
    });
    if (later.length > 0) {
      await this.events.save(event.markExpanded(this.clock.now()));
      return 0;
    }

    const { professionalIds, branchIds } = event.scopeIds();
    const [professionalSubs, branchSubs] = await Promise.all([
      this.subscriptions.findEnabledByProfessionals(professionalIds),
      this.subscriptions.findEnabledByBranches(branchIds),
    ]);
    const subscriptions = [...professionalSubs, ...branchSubs];
    const contacts = await this.contacts.findByIds([
      ...new Set(subscriptions.map((item) => item.contactId)),
    ]);
    const recipients = resolveNotificationRecipients({
      event,
      contacts,
      subscriptions,
    });
    const now = this.clock.now();
    return this.transactions.run(async () => {
      const created = await this.deliveries.createMany(
        recipients.map((recipient) => ({
          eventId: event.id,
          contactId: recipient.contact.id,
          destinationPhoneE164: recipient.contact.phoneE164,
          nextAttemptAt: now,
        })),
      );
      await this.events.save(event.markExpanded(now));
      return created.length;
    });
  }
}
