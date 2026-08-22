import { AppointmentReminderPublisher } from './appointment-reminder.publisher';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import {
  AgentTone,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { Client } from '@domain/clients/entities/client.entity';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { PlanFeature } from '@domain/subscriptions/value-objects/plan-config.vo';

const now = new Date('2026-08-19T12:00:00.000Z');

const appointment = (
  extras: Partial<ConstructorParameters<typeof Appointment>[0]> = {},
): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    bookingContactClientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-21T15:00:00.000Z'),
    endsAt: new Date('2026-08-21T16:00:00.000Z'),
    status: AppointmentStatus.CONFIRMED,
    price: Money.of('150.00', Currency.BOB),
    ...extras,
  });

const config = (
  extras: Partial<ConstructorParameters<typeof BusinessConfig>[0]> = {},
): BusinessConfig =>
  new BusinessConfig({
    id: 'bc1',
    tenantId: 't1',
    slug: 'glow',
    agentName: 'Vale',
    tone: AgentTone.WARM,
    currency: Currency.BOB,
    bookingPolicy: {
      minLeadTimeHours: 2,
      cancelRescheduleHours: 24,
      noShowMessage: 'Avisanos.',
    },
    clientReminderPolicy: {
      enabled: true,
      offsets: ['24h', '2h'],
      thankYouAfterVisit: false,
    },
    faq: {},
    ...extras,
  });

const client = (phoneE164: string | null): Client =>
  new Client({
    id: 'c1',
    tenantId: 't1',
    name: 'María',
    phoneE164,
    notes: null,
  });

describe('AppointmentReminderPublisher', () => {
  const reminders = {
    upsertMany: jest.fn().mockResolvedValue(undefined),
    cancelOpen: jest.fn().mockResolvedValue(0),
  };
  const businessConfigs = {
    findByTenant: jest.fn().mockResolvedValue(config()),
  };
  const clients = {
    findById: jest.fn().mockResolvedValue(client('+59170000001')),
  };
  const entitlements = {
    effectiveConfig: jest.fn().mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: true },
    }),
  };

  const publisher = () =>
    new AppointmentReminderPublisher(
      reminders as never,
      businessConfigs as never,
      clients as never,
      entitlements as never,
      { now: () => now },
    );

  beforeEach(() => {
    reminders.upsertMany.mockClear();
    reminders.cancelOpen.mockClear();
    businessConfigs.findByTenant.mockResolvedValue(config());
    clients.findById.mockResolvedValue(client('+59170000001'));
    entitlements.effectiveConfig.mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: true },
    });
  });

  it('upserts catalog offsets whose fire time is still in the future', async () => {
    await publisher().syncPreVisit(appointment());

    expect(reminders.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        appointmentId: 'a1',
        kind: AppointmentReminderKind.OFFSET_24H,
        destinationPhoneE164: '+59170000001',
        nextAttemptAt: new Date('2026-08-20T15:00:00.000Z'),
      }),
      expect.objectContaining({
        kind: AppointmentReminderKind.OFFSET_2H,
        nextAttemptAt: new Date('2026-08-21T13:00:00.000Z'),
      }),
    ]);
  });

  it('is idempotent: a second sync upserts the same unique kinds', async () => {
    const pub = publisher();
    await pub.syncPreVisit(appointment());
    await pub.syncPreVisit(appointment());

    expect(reminders.upsertMany).toHaveBeenCalledTimes(2);
    expect(reminders.upsertMany.mock.calls[0][0]).toEqual(
      reminders.upsertMany.mock.calls[1][0],
    );
  });

  it('skips an offset whose fire time has already passed', async () => {
    await publisher().syncPreVisit(
      appointment({
        startsAt: new Date('2026-08-19T13:00:00.000Z'),
        endsAt: new Date('2026-08-19T14:00:00.000Z'),
      }),
    );

    expect(reminders.upsertMany).toHaveBeenCalledWith([]);
    expect(reminders.cancelOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        kinds: expect.arrayContaining([
          AppointmentReminderKind.OFFSET_24H,
          AppointmentReminderKind.OFFSET_2H,
        ]),
      }),
    );
  });

  it('materializes payment reminders for a pending deposit appointment', async () => {
    await publisher().syncPreVisit(
      appointment({ status: AppointmentStatus.PENDING_DEPOSIT }),
    );

    expect(reminders.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        appointmentId: 'a1',
        kind: AppointmentReminderKind.OFFSET_24H,
      }),
      expect.objectContaining({
        appointmentId: 'a1',
        kind: AppointmentReminderKind.OFFSET_2H,
      }),
    ]);
  });

  it('does not materialize reminders when the plan feature is off', async () => {
    entitlements.effectiveConfig.mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: false },
    });

    await publisher().syncPreVisit(appointment());

    expect(reminders.upsertMany).not.toHaveBeenCalled();
    expect(reminders.cancelOpen).toHaveBeenCalled();
  });

  it('regenerates pre-visit reminders after a reschedule', async () => {
    const pub = publisher();
    await pub.syncPreVisit(appointment());
    reminders.upsertMany.mockClear();
    reminders.cancelOpen.mockClear();

    await pub.syncPreVisit(
      appointment({
        startsAt: new Date('2026-08-22T18:00:00.000Z'),
        endsAt: new Date('2026-08-22T19:00:00.000Z'),
      }),
    );

    expect(reminders.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: AppointmentReminderKind.OFFSET_24H,
        nextAttemptAt: new Date('2026-08-21T18:00:00.000Z'),
      }),
      expect.objectContaining({
        kind: AppointmentReminderKind.OFFSET_2H,
        nextAttemptAt: new Date('2026-08-22T16:00:00.000Z'),
      }),
    ]);
  });
});
