import { AppointmentNotificationSubscription } from '../entities/appointment-notification-subscription.entity';
import { NotificationContact } from '../entities/notification-contact.entity';
import { AppointmentNotificationEvent } from '../entities/appointment-notification-event.entity';
import { MAX_NOTIFICATION_RECIPIENTS_PER_EVENT } from './notification-limits';

export interface ResolvedNotificationRecipient {
  contact: NotificationContact;
  subscriptionIds: string[];
}

export function resolveNotificationRecipients(input: {
  event: AppointmentNotificationEvent;
  contacts: NotificationContact[];
  subscriptions: AppointmentNotificationSubscription[];
}): ResolvedNotificationRecipient[] {
  const { professionalIds, branchIds } = input.event.scopeIds();
  const contactsById = new Map(
    input.contacts.map((contact) => [contact.id, contact]),
  );
  const grouped = new Map<string, string[]>();

  for (const subscription of input.subscriptions) {
    if (!subscription.isEnabled()) continue;
    const matchesProfessional =
      subscription.professionalId !== null &&
      professionalIds.includes(subscription.professionalId);
    const matchesBranch =
      subscription.branchId !== null &&
      branchIds.includes(subscription.branchId);
    if (!matchesProfessional && !matchesBranch) continue;

    const contact = contactsById.get(subscription.contactId);
    if (!contact?.canReceiveAlerts()) continue;

    const ids = grouped.get(contact.id) ?? [];
    ids.push(subscription.id);
    grouped.set(contact.id, ids);
  }

  const recipients: ResolvedNotificationRecipient[] = [];
  for (const [contactId, subscriptionIds] of grouped) {
    const contact = contactsById.get(contactId);
    if (!contact) continue;
    recipients.push({ contact, subscriptionIds });
    if (recipients.length >= MAX_NOTIFICATION_RECIPIENTS_PER_EVENT) break;
  }

  return recipients;
}
