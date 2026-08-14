import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  InvalidAppointmentTransitionError,
  SlotUnavailableError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import { BranchProfessionalRepository } from '@domain/branches/repositories/branch-professional.repository';
import { BranchServiceRepository } from '@domain/branches/repositories/branch-service.repository';
import {
  AgentTone,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { ScheduleBlockRepository } from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { RescheduleAppointmentUseCase } from './reschedule-appointment.use-case';

const hours: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: null,
  sun: null,
};

const branch = new Branch({
  id: 'b1',
  tenantId: 't1',
  name: 'Centro',
  slug: 'centro',
  address: null,
  mapsUrl: null,
  phone: null,
  weeklyHours: hours,
  timezone: null,
  isPrimary: true,
  isActive: true,
});

const service = (requiresDeposit: boolean): Service =>
  new Service({
    id: 's1',
    tenantId: 't1',
    name: 'Limpieza',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '150.00',
    requiresDeposit,
    depositAmount: requiresDeposit ? '50.00' : null,
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: ['p1'],
  });

// Inside the policy's 24 h window: rescheduling here puts the deposit at risk.
const appointment = (
  status: AppointmentStatus,
  id = 'a1',
  startsAt = '2026-08-02T15:00:00.000Z',
): Appointment =>
  new Appointment({
    id,
    tenantId: 't1',
    branchId: branch.id,
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date(startsAt),
    endsAt: new Date(Date.parse(startsAt) + 3_600_000),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

describe('RescheduleAppointmentUseCase', () => {
  let appointmentRepository: jest.Mocked<
    Pick<AppointmentRepository, 'findById' | 'save' | 'findOverlapping'>
  >;
  let scheduleBlockRepository: jest.Mocked<
    Pick<ScheduleBlockRepository, 'findOverlapping'>
  >;
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: RescheduleAppointmentUseCase;

  const newStartsAt = '2026-08-05T15:00:00.000Z';

  beforeEach(() => {
    appointmentRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(appointment(AppointmentStatus.CONFIRMED)),
      save: jest.fn((moved: Appointment) => Promise.resolve(moved)),
      findOverlapping: jest.fn().mockResolvedValue([]),
    };
    scheduleBlockRepository = {
      findOverlapping: jest.fn().mockResolvedValue([]),
    };
    serviceRepository = {
      findById: jest.fn().mockResolvedValue(service(false)),
    };
    audit = { record: jest.fn() };

    const professionalRepository: jest.Mocked<
      Pick<ProfessionalRepository, 'findById'>
    > = {
      findById: jest.fn().mockResolvedValue(
        new Professional({
          id: 'p1',
          tenantId: 't1',
          name: 'Camila',
          isActive: true,
        }),
      ),
    };
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
    const tenantRepository: jest.Mocked<Pick<TenantRepository, 'findById'>> = {
      findById: jest.fn().mockResolvedValue(
        new Tenant({
          id: 't1',
          name: 'Estética Glow',
          timezone: 'UTC',
          status: TenantStatus.ACTIVE,
        }),
      ),
    };
    const clock: ClockPort = {
      now: () => new Date('2026-08-02T00:00:00.000Z'),
    };
    const branchResolver = {
      resolve: jest.fn().mockResolvedValue(branch),
    };
    const branchServiceRepository = {
      findByBranchAndService: jest.fn().mockResolvedValue(
        new BranchService({
          tenantId: 't1',
          branchId: branch.id,
          serviceId: 's1',
          priceOverrideAmount: null,
          depositAmountOverrideAmount: null,
          depositQrId: null,
          isActive: true,
        }),
      ),
    };
    const branchProfessionalRepository = {
      findByBranchAndProfessional: jest.fn().mockResolvedValue(
        new BranchProfessional({
          tenantId: 't1',
          branchId: branch.id,
          professionalId: 'p1',
          weeklyHours: hours,
          isActive: true,
        }),
      ),
    };

    useCase = new RescheduleAppointmentUseCase(
      appointmentRepository as unknown as AppointmentRepository,
      new AppointmentSlotValidator(
        new ScheduleContextResolver(
          branchResolver as unknown as BranchResolver,
          professionalRepository as unknown as ProfessionalRepository,
          serviceRepository as unknown as ServiceRepository,
          branchServiceRepository as unknown as BranchServiceRepository,
          branchProfessionalRepository as unknown as BranchProfessionalRepository,
          businessConfigRepository as unknown as BusinessConfigRepository,
          tenantRepository as unknown as TenantRepository,
          clock,
        ),
        appointmentRepository as unknown as AppointmentRepository,
        scheduleBlockRepository as unknown as ScheduleBlockRepository,
      ),
      clock,
      audit as unknown as AuditRecorder,
      { changed: jest.fn() } as unknown as AgendaEventPublisher,
    );
  });

  it('moves the appointment to the new available time', async () => {
    const result = await useCase.execute('a1', { startsAt: newStartsAt });

    expect(result.appointment.startsAt.toISOString()).toBe(newStartsAt);
    expect(result.appointment.status).toBe(AppointmentStatus.CONFIRMED);
    expect(result.depositRequiresReview).toBe(false);
    expect(appointmentRepository.save).toHaveBeenCalled();
  });

  it('does not count the appointment itself as a busy time', async () => {
    await useCase.execute('a1', { startsAt: newStartsAt });

    expect(appointmentRepository.findOverlapping).toHaveBeenCalledWith(
      expect.objectContaining({ excludeAppointmentId: 'a1' }),
    );
  });

  it('rejects a time already taken by another appointment', async () => {
    appointmentRepository.findOverlapping.mockResolvedValue([
      appointment(AppointmentStatus.CONFIRMED, 'a2', newStartsAt),
    ]);

    await expect(
      useCase.execute('a1', { startsAt: newStartsAt }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('does not reschedule a cancelled appointment', async () => {
    appointmentRepository.findById.mockResolvedValue(
      appointment(AppointmentStatus.CANCELLED),
    );

    await expect(
      useCase.execute('a1', { startsAt: newStartsAt }),
    ).rejects.toBeInstanceOf(InvalidAppointmentTransitionError);
  });

  it('flags the deposit as at risk when the change is outside the window', async () => {
    serviceRepository.findById.mockResolvedValue(service(true));

    const result = await useCase.execute('a1', { startsAt: newStartsAt });

    expect(result.depositAtRisk).toBe(true);
  });

  it("does not touch another client's appointments", async () => {
    await expect(
      useCase.execute(
        'a1',
        { startsAt: newStartsAt },
        { restrictToClientId: 'otra-clienta' },
      ),
    ).rejects.toThrow();
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it('keeps a custom length when staff moves the appointment without an override', async () => {
    appointmentRepository.findById.mockResolvedValue(
      new Appointment({
        id: 'a1',
        tenantId: 't1',
        branchId: branch.id,
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: new Date('2026-08-02T15:00:00.000Z'),
        endsAt: new Date('2026-08-02T15:45:00.000Z'),
        status: AppointmentStatus.CONFIRMED,
        price: Money.of('150.00', Currency.BOB),
      }),
    );

    const result = await useCase.execute(
      'a1',
      { startsAt: newStartsAt },
      { actor: BookingActor.STAFF },
    );

    expect(result.appointment.endsAt.toISOString()).toBe(
      '2026-08-05T15:45:00.000Z',
    );
  });

  it('lets staff stretch the appointment on reschedule', async () => {
    const result = await useCase.execute(
      'a1',
      { startsAt: newStartsAt, durationMinutes: 90 },
      { actor: BookingActor.STAFF },
    );

    expect(result.appointment.endsAt.toISOString()).toBe(
      '2026-08-05T16:30:00.000Z',
    );
  });
});
