import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentViewRepository } from '@domain/appointments/repositories/appointment-view.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchRepository } from '@domain/branches/repositories/branch.repository';
import {
  AgentTone,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { OutboundClass } from '@domain/messaging/ports/messaging.port';
import { AppointmentReminder } from '@domain/reminders/entities/appointment-reminder.entity';
import { ClientReminderCopyPort } from '@domain/reminders/ports/client-reminder-copy.port';
import { AppointmentReminderRepository } from '@domain/reminders/repositories/appointment-reminder.repository';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { AppointmentReminderStatus } from '@domain/reminders/value-objects/appointment-reminder-status.vo';
import { PlanFeature } from '@domain/subscriptions/value-objects/plan-config.vo';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { SendAppointmentReminderUseCase } from './send-appointment-reminder.use-case';
import { ErrorCode, InternalError } from '@domain/common/exceptions';

const now = new Date('2026-08-20T12:00:00.000Z');

const reminder = (
  extras: Partial<ConstructorParameters<typeof AppointmentReminder>[0]> = {},
): AppointmentReminder =>
  new AppointmentReminder({
    id: 'r1',
    tenantId: 't1',
    appointmentId: 'a1',
    kind: AppointmentReminderKind.OFFSET_24H,
    destinationPhoneE164: '+59170000001',
    renderedContent: null,
    status: AppointmentReminderStatus.PENDING,
    attemptCount: 0,
    nextAttemptAt: now,
    leaseUntil: null,
    providerMessageId: null,
    acceptedAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastError: null,
    ...extras,
  });

describe('SendAppointmentReminderUseCase', () => {
  let appointmentStatus = AppointmentStatus.CONFIRMED;
  const reminders: jest.Mocked<
    Pick<
      AppointmentReminderRepository,
      'findById' | 'save' | 'tryMarkDispatching'
    >
  > = {
    findById: jest.fn(),
    save: jest.fn((row) => Promise.resolve(row)),
    tryMarkDispatching: jest.fn(),
  };
  const messaging = {
    sendText: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.1' }),
    sendMedia: jest.fn(),
  };
  const copy = {
    render: jest.fn().mockReturnValue('Recordatorio'),
  };
  const entitlements = {
    effectiveConfig: jest.fn().mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: true },
    }),
  };

  const useCase = () =>
    new SendAppointmentReminderUseCase(
      reminders as unknown as AppointmentReminderRepository,
      {
        findById: jest.fn().mockImplementation(async () => ({
          appointment: new Appointment({
            id: 'a1',
            tenantId: 't1',
            branchId: 'b1',
            clientId: 'c1',
            professionalId: 'p1',
            serviceId: 's1',
            startsAt: new Date('2026-08-21T15:00:00.000Z'),
            endsAt: new Date('2026-08-21T16:00:00.000Z'),
            status: appointmentStatus,
            price: Money.of('150.00', Currency.BOB),
          }),
          service: { name: 'Limpieza' },
          professional: { name: 'Camila' },
        })),
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
      } as never,
      {
        findByTenant: jest.fn().mockResolvedValue(
          new BusinessConfig({
            id: 'bc1',
            tenantId: 't1',
            slug: 'glow',
            agentName: 'Luna',
            tone: AgentTone.WARM,
            currency: Currency.BOB,
            bookingPolicy: {
              minLeadTimeHours: 2,
              cancelRescheduleHours: 24,
              noShowMessage: 'Avisanos.',
            },
            faq: {},
          }),
        ),
      } as unknown as BusinessConfigRepository,
      copy as unknown as ClientReminderCopyPort,
      messaging as never,
      entitlements as never,
      { now: () => now },
    );

  beforeEach(() => {
    appointmentStatus = AppointmentStatus.CONFIRMED;
    reminders.findById.mockResolvedValue(reminder());
    reminders.tryMarkDispatching.mockImplementation(
      async ({ renderedContent, leaseUntil }) =>
        reminder().withContent(renderedContent).markDispatching({ leaseUntil }),
    );
    messaging.sendText.mockClear();
    messaging.sendMedia.mockClear();
    copy.render.mockReset().mockReturnValue('Recordatorio');
  });

  it('sends over WhatsApp as TRANSACTIONAL', async () => {
    await useCase().execute('r1');

    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        outboundClass: OutboundClass.TRANSACTIONAL,
        toE164: '+59170000001',
        text: 'Recordatorio',
      }),
    );
  });

  it('renders a payment reminder for a pending deposit appointment', async () => {
    appointmentStatus = AppointmentStatus.PENDING_DEPOSIT;
    copy.render.mockReturnValue('Mandame el comprobante');

    await useCase().execute('r1');

    expect(copy.render).toHaveBeenCalledWith(
      expect.objectContaining({ depositPending: true }),
    );
    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Mandame el comprobante' }),
    );
    expect(messaging.sendMedia).not.toHaveBeenCalled();
  });

  it('re-renders as a visit reminder when the deposit is verified after leasing', async () => {
    appointmentStatus = AppointmentStatus.PENDING_DEPOSIT;
    copy.render.mockImplementation(({ depositPending }) =>
      depositPending ? 'Seña pendiente' : 'Recordatorio de cita',
    );
    reminders.tryMarkDispatching.mockImplementation(
      async ({ renderedContent, leaseUntil }) => {
        appointmentStatus = AppointmentStatus.CONFIRMED;
        return reminder()
          .withContent(renderedContent)
          .markDispatching({ leaseUntil });
      },
    );

    await useCase().execute('r1');

    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Recordatorio de cita' }),
    );
  });

  it('suppresses when the plan does not include reminders', async () => {
    entitlements.effectiveConfig.mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: false },
    });

    await useCase().execute('r1');

    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(reminders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentReminderStatus.SUPPRESSED,
        lastErrorCode: 'plan_feature',
      }),
    );
  });

  it('does not treat a generic send failure as success', async () => {
    entitlements.effectiveConfig.mockResolvedValue({
      features: { [PlanFeature.REMINDERS]: true },
    });
    messaging.sendText.mockRejectedValue(
      new InternalError(ErrorCode.EVOLUTION_API_ERROR),
    );

    await useCase().execute('r1');

    expect(reminders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentReminderStatus.FAILED,
      }),
    );
  });
});
