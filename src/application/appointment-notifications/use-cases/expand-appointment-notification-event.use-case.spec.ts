import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import { AppointmentNotificationEvent } from '@domain/appointment-notifications/entities/appointment-notification-event.entity';
import { AppointmentNotificationSubscription } from '@domain/appointment-notifications/entities/appointment-notification-subscription.entity';
import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { AppointmentNotificationDeliveryRepository } from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { AppointmentNotificationEventRepository } from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { AppointmentNotificationSubscriptionRepository } from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { NotificationContactRepository } from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { ClockPort } from '@domain/common/ports/clock.port';
import { TransactionPort } from '@domain/common/ports/transaction.port';
import { ExpandAppointmentNotificationEventUseCase } from './expand-appointment-notification-event.use-case';

const now = new Date('2026-08-18T12:02:00.000Z');

const bookedEvent = (
  extras: Partial<
    ConstructorParameters<typeof AppointmentNotificationEvent>[0]
  > = {},
) =>
  new AppointmentNotificationEvent({
    id: 'e1',
    tenantId: 't1',
    appointmentId: 'a1',
    sequence: 1,
    kind: AppointmentNotificationKind.BOOKED,
    previous: null,
    current: {
      professionalId: 'p1',
      branchId: 'b1',
      startsAt: new Date('2026-08-18T18:00:00.000Z'),
      endsAt: new Date('2026-08-18T19:00:00.000Z'),
    },
    occurredAt: new Date('2026-08-18T12:00:00.000Z'),
    expandedAt: null,
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    ...extras,
  });

const activeContact = new NotificationContact({
  id: 'c1',
  tenantId: 't1',
  displayName: 'Camila',
  phoneE164: '+59171234567',
  status: NotificationContactStatus.ACTIVE,
  activationCodeHash: null,
  activationExpiresAt: null,
  activationProviderMessageId: 'wamid.1',
  activatedAt: now,
  pausedAt: null,
  deactivatedAt: null,
  lastInboundAt: now,
});

const professionalSub = new AppointmentNotificationSubscription({
  id: 's1',
  tenantId: 't1',
  contactId: 'c1',
  professionalId: 'p1',
  branchId: null,
  enabledAt: now,
  disabledAt: null,
});

describe('ExpandAppointmentNotificationEventUseCase', () => {
  let events: jest.Mocked<
    Pick<
      AppointmentNotificationEventRepository,
      'findById' | 'findLaterForAppointment' | 'save'
    >
  >;
  let subscriptions: jest.Mocked<
    Pick<
      AppointmentNotificationSubscriptionRepository,
      'findEnabledByProfessionals' | 'findEnabledByBranches'
    >
  >;
  let contacts: jest.Mocked<Pick<NotificationContactRepository, 'findByIds'>>;
  let deliveries: jest.Mocked<
    Pick<AppointmentNotificationDeliveryRepository, 'createMany'>
  >;
  let clock: ClockPort;
  let transactions: TransactionPort;
  let useCase: ExpandAppointmentNotificationEventUseCase;

  beforeEach(() => {
    events = {
      findById: jest.fn().mockResolvedValue(bookedEvent()),
      findLaterForAppointment: jest.fn().mockResolvedValue([]),
      save: jest.fn((event) => Promise.resolve(event)),
    };
    subscriptions = {
      findEnabledByProfessionals: jest
        .fn()
        .mockResolvedValue([professionalSub]),
      findEnabledByBranches: jest.fn().mockResolvedValue([]),
    };
    contacts = { findByIds: jest.fn().mockResolvedValue([activeContact]) };
    deliveries = {
      createMany: jest
        .fn()
        .mockResolvedValue([{ id: 'd1' } as AppointmentNotificationDelivery]),
    };
    clock = { now: () => now };
    transactions = {
      run: jest.fn((operation) => operation()),
    };
    useCase = new ExpandAppointmentNotificationEventUseCase(
      events as unknown as AppointmentNotificationEventRepository,
      subscriptions as unknown as AppointmentNotificationSubscriptionRepository,
      contacts as unknown as NotificationContactRepository,
      deliveries as unknown as AppointmentNotificationDeliveryRepository,
      clock,
      transactions,
    );
  });

  it('creates one delivery per unique active contact', async () => {
    const created = await useCase.execute('e1');

    expect(created).toBe(1);
    expect(deliveries.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        eventId: 'e1',
        contactId: 'c1',
        destinationPhoneE164: '+59171234567',
      }),
    ]);
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ expandedAt: now }),
    );
    expect(transactions.run).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the event was already expanded', async () => {
    events.findById.mockResolvedValue(bookedEvent({ expandedAt: now }));

    await expect(useCase.execute('e1')).resolves.toBe(0);
    expect(deliveries.createMany).not.toHaveBeenCalled();
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('skips deliveries when a later event of the same appointment supersedes it', async () => {
    events.findLaterForAppointment.mockResolvedValue([
      bookedEvent({
        id: 'e2',
        sequence: 2,
        kind: AppointmentNotificationKind.CANCELLED,
      }),
    ]);

    await expect(useCase.execute('e1')).resolves.toBe(0);
    expect(deliveries.createMany).not.toHaveBeenCalled();
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ expandedAt: now }),
    );
  });
});
