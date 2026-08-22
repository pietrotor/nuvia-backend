import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import { AppointmentNotificationEvent } from '@domain/appointment-notifications/entities/appointment-notification-event.entity';
import { AppointmentNotificationSubscription } from '@domain/appointment-notifications/entities/appointment-notification-subscription.entity';
import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import {
  OutboundBlockedError,
  OutboundDeferredError,
} from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import { AppointmentNotificationCopyPort } from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import { AppointmentNotificationDeliveryRepository } from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { AppointmentNotificationEventRepository } from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { AppointmentNotificationSubscriptionRepository } from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { NotificationContactRepository } from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { AppointmentViewRepository } from '@domain/appointments/repositories/appointment-view.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchRepository } from '@domain/branches/repositories/branch.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { SendAppointmentNotificationDeliveryUseCase } from './send-appointment-notification-delivery.use-case';

const now = new Date('2026-08-18T16:00:00.000Z');

const delivery = (
  extras: Partial<
    ConstructorParameters<typeof AppointmentNotificationDelivery>[0]
  > = {},
) =>
  new AppointmentNotificationDelivery({
    id: 'd1',
    tenantId: 't1',
    eventId: 'e1',
    contactId: 'c1',
    destinationPhoneE164: '+59171234567',
    renderedContent: null,
    status: AppointmentNotificationDeliveryStatus.PENDING,
    attemptCount: 0,
    nextAttemptAt: now,
    leaseUntil: null,
    providerMessageId: null,
    acceptedAt: null,
    deliveredAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastError: null,
    ...extras,
  });

const event = (
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
      startsAt: new Date('2026-08-19T18:00:00.000Z'),
      endsAt: new Date('2026-08-19T19:00:00.000Z'),
    },
    occurredAt: now,
    expandedAt: now,
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    ...extras,
  });

const contact = (status = NotificationContactStatus.ACTIVE) =>
  new NotificationContact({
    id: 'c1',
    tenantId: 't1',
    displayName: 'Camila',
    phoneE164: '+59171234567',
    status,
    activationCodeHash: null,
    activationExpiresAt: null,
    activationProviderMessageId: 'wamid.1',
    activatedAt: now,
    pausedAt: null,
    deactivatedAt: null,
    lastInboundAt: now,
  });

describe('SendAppointmentNotificationDeliveryUseCase', () => {
  let deliveries: jest.Mocked<
    Pick<
      AppointmentNotificationDeliveryRepository,
      'findById' | 'save' | 'findOpenForContactSince' | 'tryMarkDispatching'
    >
  >;
  let events: jest.Mocked<
    Pick<
      AppointmentNotificationEventRepository,
      'findById' | 'findLaterForAppointment'
    >
  >;
  let contacts: jest.Mocked<Pick<NotificationContactRepository, 'findById'>>;
  let subscriptions: jest.Mocked<
    Pick<
      AppointmentNotificationSubscriptionRepository,
      'findEnabledByProfessional'
    >
  >;
  let messaging: jest.Mocked<Pick<MessagingPort, 'sendText'>>;
  let useCase: SendAppointmentNotificationDeliveryUseCase;

  beforeEach(() => {
    deliveries = {
      findById: jest.fn().mockResolvedValue(delivery()),
      save: jest.fn((row) => Promise.resolve(row)),
      findOpenForContactSince: jest.fn().mockResolvedValue([]),
      tryMarkDispatching: jest.fn(async ({ renderedContent, leaseUntil }) =>
        delivery().withContent(renderedContent).markDispatching({ leaseUntil }),
      ),
    };
    events = {
      findById: jest.fn().mockResolvedValue(event()),
      findLaterForAppointment: jest.fn().mockResolvedValue([]),
    };
    contacts = { findById: jest.fn().mockResolvedValue(contact()) };
    subscriptions = {
      findEnabledByProfessional: jest.fn().mockResolvedValue([
        new AppointmentNotificationSubscription({
          id: 's1',
          tenantId: 't1',
          contactId: 'c1',
          professionalId: 'p1',
          branchId: null,
          enabledAt: now,
          disabledAt: null,
        }),
      ]),
    };
    messaging = {
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.out' }),
    };
    const copy: AppointmentNotificationCopyPort = {
      renderAlert: jest.fn().mockReturnValue('Aviso automático de Nuvi'),
      handshakeReply: jest.fn(),
    };
    useCase = new SendAppointmentNotificationDeliveryUseCase(
      deliveries as unknown as AppointmentNotificationDeliveryRepository,
      events as unknown as AppointmentNotificationEventRepository,
      contacts as unknown as NotificationContactRepository,
      subscriptions as unknown as AppointmentNotificationSubscriptionRepository,
      {
        findById: jest.fn().mockResolvedValue({
          client: { name: 'María López' },
          service: { name: 'Limpieza' },
          professional: { name: 'Camila' },
        }),
      } as unknown as AppointmentViewRepository,
      {
        findById: jest.fn().mockResolvedValue(
          new Branch({
            id: 'b1',
            tenantId: 't1',
            name: 'Centro',
            slug: 'centro',
            address: null,
            mapsUrl: null,
            phone: null,
            weeklyHours: {
              mon: { start: '09:00', end: '18:00' },
              tue: { start: '09:00', end: '18:00' },
              wed: { start: '09:00', end: '18:00' },
              thu: { start: '09:00', end: '18:00' },
              fri: { start: '09:00', end: '18:00' },
              sat: null,
              sun: null,
            },
            timezone: 'America/La_Paz',
            isPrimary: true,
            isActive: true,
          }),
        ),
      } as unknown as BranchRepository,
      {
        findById: jest.fn().mockResolvedValue(
          new Tenant({
            id: 't1',
            name: 'Glow',
            timezone: 'America/La_Paz',
            status: TenantStatus.ACTIVE,
          }),
        ),
      } as unknown as TenantRepository,
      copy,
      messaging as unknown as MessagingPort,
      { now: () => now } as ClockPort,
    );
  });

  it('accepts a send when the provider returns a message id', async () => {
    await useCase.execute('d1');

    expect(messaging.sendText).toHaveBeenCalled();
    expect(deliveries.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.ACCEPTED,
        providerMessageId: 'wamid.out',
      }),
    );
  });

  it('suppresses a pending contact instead of sending', async () => {
    contacts.findById.mockResolvedValue(
      contact(NotificationContactStatus.PENDING),
    );

    await useCase.execute('d1');

    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.SUPPRESSED,
        lastErrorCode: 'contact_inactive',
      }),
    );
  });

  it('marks a provider timeout as unknown and does not retry', async () => {
    messaging.sendText.mockRejectedValue(
      new InternalError(ErrorCode.EVOLUTION_API_ERROR, { cause: 'timeout' }),
    );

    await useCase.execute('d1');

    expect(deliveries.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.UNKNOWN,
      }),
    );
  });

  it('fails a 463 without retrying', async () => {
    messaging.sendText.mockRejectedValue(
      new InternalError(ErrorCode.EVOLUTION_API_ERROR, {
        status: 463,
        body: 'device removed',
      }),
    );

    await useCase.execute('d1');

    expect(deliveries.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.FAILED,
        lastErrorCode: 'whatsapp_463',
      }),
    );
  });

  it('defers when the shared outbound gate is busy', async () => {
    messaging.sendText.mockRejectedValue(new OutboundDeferredError(8_000));

    await useCase.execute('d1');

    const saved = deliveries.save.mock.calls.map(([row]) => row);
    const deferred = saved[saved.length - 1];
    expect(deferred).toEqual(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.DEFERRED,
        nextAttemptAt: new Date(now.getTime() + 8_000),
        leaseUntil: null,
        attemptCount: 1,
      }),
    );
    const statuses = saved.map((row) => row.status);
    expect(statuses).not.toContain(
      AppointmentNotificationDeliveryStatus.ACCEPTED,
    );
    expect(statuses).not.toContain(
      AppointmentNotificationDeliveryStatus.FAILED,
    );
  });

  it('does not send when another worker already leased the delivery', async () => {
    deliveries.tryMarkDispatching.mockResolvedValue(null);

    await useCase.execute('d1');

    expect(messaging.sendText).not.toHaveBeenCalled();
  });

  it('defers quiet hours before leasing so the attempt count stays put', async () => {
    const quietClock = {
      now: () => new Date('2026-08-19T02:00:00.000Z'),
    } as ClockPort;
    useCase = new SendAppointmentNotificationDeliveryUseCase(
      deliveries as unknown as AppointmentNotificationDeliveryRepository,
      events as unknown as AppointmentNotificationEventRepository,
      contacts as unknown as NotificationContactRepository,
      subscriptions as unknown as AppointmentNotificationSubscriptionRepository,
      {
        findById: jest.fn().mockResolvedValue({
          client: { name: 'María López' },
          service: { name: 'Limpieza' },
          professional: { name: 'Camila' },
        }),
      } as unknown as AppointmentViewRepository,
      {
        findById: jest.fn().mockResolvedValue(
          new Branch({
            id: 'b1',
            tenantId: 't1',
            name: 'Centro',
            slug: 'centro',
            address: null,
            mapsUrl: null,
            phone: null,
            weeklyHours: {
              mon: { start: '09:00', end: '18:00' },
              tue: { start: '09:00', end: '18:00' },
              wed: { start: '09:00', end: '18:00' },
              thu: { start: '09:00', end: '18:00' },
              fri: { start: '09:00', end: '18:00' },
              sat: null,
              sun: null,
            },
            timezone: 'America/La_Paz',
            isPrimary: true,
            isActive: true,
          }),
        ),
      } as unknown as BranchRepository,
      {
        findById: jest.fn().mockResolvedValue(
          new Tenant({
            id: 't1',
            name: 'Glow',
            timezone: 'America/La_Paz',
            status: TenantStatus.ACTIVE,
          }),
        ),
      } as unknown as TenantRepository,
      {
        renderAlert: jest.fn().mockReturnValue('Aviso automático de Nuvi'),
        handshakeReply: jest.fn(),
      },
      messaging as unknown as MessagingPort,
      quietClock,
    );

    await useCase.execute('d1');

    expect(deliveries.tryMarkDispatching).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.DEFERRED,
        attemptCount: 0,
        leaseUntil: null,
      }),
    );
  });

  it('suppresses remaining fan-out when the breaker is open', async () => {
    messaging.sendText.mockRejectedValue(new OutboundBlockedError());

    await useCase.execute('d1');

    expect(deliveries.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.SUPPRESSED,
        lastErrorCode: 'breaker_open',
      }),
    );
  });
});
