import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidAppointmentTransitionError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import {
  AgentTone,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { CancelAppointmentUseCase } from './cancel-appointment.use-case';

const service = (requiresDeposit: boolean): Service =>
  new Service({
    id: 's1',
    tenantId: 't1',
    name: 'Láser',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '300.00',
    requiresDeposit,
    depositAmount: requiresDeposit ? '100.00' : null,
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: ['p1'],
  });

const appointment = (
  status: AppointmentStatus,
  startsAt = '2026-08-02T15:00:00.000Z',
): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date(startsAt),
    endsAt: new Date(Date.parse(startsAt) + 3_600_000),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

describe('CancelAppointmentUseCase', () => {
  let appointmentRepository: jest.Mocked<
    Pick<AppointmentRepository, 'findById' | 'save'>
  >;
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let notifications: { recordCancelled: jest.Mock };
  let useCase: CancelAppointmentUseCase;

  beforeEach(() => {
    appointmentRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(appointment(AppointmentStatus.CONFIRMED)),
      save: jest.fn((cancelled: Appointment) => Promise.resolve(cancelled)),
    };
    serviceRepository = {
      findById: jest.fn().mockResolvedValue(service(false)),
    };
    audit = { record: jest.fn() };
    notifications = { recordCancelled: jest.fn().mockResolvedValue(undefined) };

    const businessConfigRepository: jest.Mocked<
      Pick<BusinessConfigRepository, 'findByTenant'>
    > = {
      findByTenant: jest.fn().mockResolvedValue(
        new BusinessConfig({
          id: 'bc1',
          tenantId: 't1',
          slug: 'estetica-glow',
          agentName: 'Vale',
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
    };
    const clock: ClockPort = {
      now: () => new Date('2026-08-02T00:00:00.000Z'),
    };

    useCase = new CancelAppointmentUseCase(
      appointmentRepository as unknown as AppointmentRepository,
      serviceRepository as unknown as ServiceRepository,
      businessConfigRepository as unknown as BusinessConfigRepository,
      clock,
      audit as unknown as AuditRecorder,
      { changed: jest.fn() } as unknown as AgendaEventPublisher,
      notifications as never,
      { cancelOpen: jest.fn().mockResolvedValue(undefined) } as never,
      { run: (fn: () => Promise<unknown>) => fn() } as never,
    );
  });

  it('changes the status to cancelled instead of deleting the appointment', async () => {
    const result = await useCase.execute('a1');

    expect(result.appointment.status).toBe(AppointmentStatus.CANCELLED);
    expect(appointmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        status: AppointmentStatus.CANCELLED,
      }),
    );
    expect(notifications.recordCancelled).toHaveBeenCalled();
  });

  it('flags the deposit as at risk when cancelling outside the window', async () => {
    serviceRepository.findById.mockResolvedValue(service(true));

    const result = await useCase.execute('a1');

    expect(result.depositAtRisk).toBe(true);
  });

  it('does not flag the deposit as at risk when cancelling within the window', async () => {
    serviceRepository.findById.mockResolvedValue(service(true));
    appointmentRepository.findById.mockResolvedValue(
      appointment(AppointmentStatus.CONFIRMED, '2026-08-10T15:00:00.000Z'),
    );

    const result = await useCase.execute('a1');

    expect(result.depositAtRisk).toBe(false);
  });

  it("does not cancel another client's appointment", async () => {
    await expect(
      useCase.execute('a1', {}, 'otra-clienta'),
    ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    expect(appointmentRepository.save).not.toHaveBeenCalled();
    expect(notifications.recordCancelled).not.toHaveBeenCalled();
  });

  it('does not cancel an appointment that was already attended', async () => {
    appointmentRepository.findById.mockResolvedValue(
      appointment(AppointmentStatus.ATTENDED),
    );

    await expect(useCase.execute('a1')).rejects.toBeInstanceOf(
      InvalidAppointmentTransitionError,
    );
  });
});
