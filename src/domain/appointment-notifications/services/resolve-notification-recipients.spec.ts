import { AppointmentNotificationEvent } from '../entities/appointment-notification-event.entity';
import { AppointmentNotificationSubscription } from '../entities/appointment-notification-subscription.entity';
import { NotificationContact } from '../entities/notification-contact.entity';
import { AppointmentNotificationKind } from '../value-objects/appointment-notification-kind.vo';
import { NotificationContactStatus } from '../value-objects/notification-contact-status.vo';
import { resolveNotificationRecipients } from './resolve-notification-recipients';

const contact = (
  id: string,
  status = NotificationContactStatus.ACTIVE,
): NotificationContact =>
  new NotificationContact({
    id,
    tenantId: 't1',
    displayName: id,
    phoneE164: `+5917000000${id.slice(-1)}`,
    status,
    activationCodeHash: null,
    activationExpiresAt: null,
    activationProviderMessageId: null,
    activatedAt: null,
    pausedAt: null,
    deactivatedAt: null,
    lastInboundAt: null,
  });

const subscription = (input: {
  id: string;
  contactId: string;
  professionalId?: string | null;
  branchId?: string | null;
  disabledAt?: Date | null;
}): AppointmentNotificationSubscription =>
  new AppointmentNotificationSubscription({
    id: input.id,
    tenantId: 't1',
    contactId: input.contactId,
    professionalId: input.professionalId ?? null,
    branchId: input.branchId ?? null,
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    disabledAt: input.disabledAt ?? null,
  });

const event = (
  kind: AppointmentNotificationKind,
): AppointmentNotificationEvent =>
  new AppointmentNotificationEvent({
    id: 'e1',
    tenantId: 't1',
    appointmentId: 'a1',
    sequence: 1,
    kind,
    previous:
      kind === AppointmentNotificationKind.RESCHEDULED
        ? {
            professionalId: 'p-old',
            branchId: 'b-old',
            startsAt: new Date('2026-08-18T15:00:00.000Z'),
            endsAt: new Date('2026-08-18T16:00:00.000Z'),
          }
        : null,
    current: {
      professionalId: 'p-new',
      branchId: 'b-new',
      startsAt: new Date('2026-08-18T18:00:00.000Z'),
      endsAt: new Date('2026-08-18T19:00:00.000Z'),
    },
    occurredAt: new Date('2026-08-18T12:00:00.000Z'),
    expandedAt: null,
    attemptCount: 0,
    nextAttemptAt: new Date('2026-08-18T12:01:15.000Z'),
    lastError: null,
  });

describe('resolveNotificationRecipients', () => {
  it('deduplicates a contact that matches professional and branch scopes', () => {
    const recipients = resolveNotificationRecipients({
      event: event(AppointmentNotificationKind.BOOKED),
      contacts: [contact('c1')],
      subscriptions: [
        subscription({ id: 's1', contactId: 'c1', professionalId: 'p-new' }),
        subscription({ id: 's2', contactId: 'c1', branchId: 'b-new' }),
      ],
    });

    expect(recipients).toHaveLength(1);
    expect(recipients[0].subscriptionIds).toEqual(['s1', 's2']);
  });

  it('unions previous and current scopes on reschedule', () => {
    const recipients = resolveNotificationRecipients({
      event: event(AppointmentNotificationKind.RESCHEDULED),
      contacts: [contact('c1'), contact('c2')],
      subscriptions: [
        subscription({ id: 's1', contactId: 'c1', professionalId: 'p-old' }),
        subscription({ id: 's2', contactId: 'c2', branchId: 'b-new' }),
      ],
    });

    expect(recipients.map((item) => item.contact.id).sort()).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('skips pending, paused, deactivated and disabled subscriptions', () => {
    const recipients = resolveNotificationRecipients({
      event: event(AppointmentNotificationKind.CANCELLED),
      contacts: [
        contact('c1', NotificationContactStatus.PENDING),
        contact('c2', NotificationContactStatus.PAUSED),
        contact('c3', NotificationContactStatus.DEACTIVATED),
        contact('c4'),
      ],
      subscriptions: [
        subscription({ id: 's1', contactId: 'c1', professionalId: 'p-new' }),
        subscription({ id: 's2', contactId: 'c2', professionalId: 'p-new' }),
        subscription({ id: 's3', contactId: 'c3', professionalId: 'p-new' }),
        subscription({
          id: 's4',
          contactId: 'c4',
          professionalId: 'p-new',
          disabledAt: new Date(),
        }),
      ],
    });

    expect(recipients).toHaveLength(0);
  });

  it('caps unique recipients per event', () => {
    const contacts = [1, 2, 3, 4, 5, 6].map((n) => contact(`c${n}`));
    const recipients = resolveNotificationRecipients({
      event: event(AppointmentNotificationKind.BOOKED),
      contacts,
      subscriptions: contacts.map((item, index) =>
        subscription({
          id: `s${index}`,
          contactId: item.id,
          professionalId: 'p-new',
        }),
      ),
    });

    expect(recipients).toHaveLength(5);
  });
});
