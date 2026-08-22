import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { BookAppointmentUseCase } from './book-appointment.use-case';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import { BranchProfessionalRepository } from '@domain/branches/repositories/branch-professional.repository';
import { BranchServiceRepository } from '@domain/branches/repositories/branch-service.repository';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { ScheduleBlockRepository } from '@domain/schedule-blocks/repositories/schedule-block.repository';
import {
  AgentTone,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { ClockPort } from '@domain/common/ports/clock.port';

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

describe('BookAppointmentUseCase', () => {
  let appointmentRepository: jest.Mocked<
    Pick<AppointmentRepository, 'create' | 'findOverlapping'>
  >;
  let professionalRepository: jest.Mocked<
    Pick<ProfessionalRepository, 'findById'>
  >;
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let clientRepository: jest.Mocked<Pick<ClientRepository, 'findById'>>;
  let scheduleBlockRepository: jest.Mocked<
    Pick<ScheduleBlockRepository, 'findOverlapping'>
  >;
  let businessConfigRepository: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let tenantRepository: jest.Mocked<Pick<TenantRepository, 'findById'>>;
  let now: Date;
  let clock: ClockPort;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let notifications: { recordBooked: jest.Mock };
  let useCase: BookAppointmentUseCase;

  beforeEach(() => {
    appointmentRepository = {
      create: jest.fn(),
      findOverlapping: jest.fn().mockResolvedValue([]),
    };
    professionalRepository = { findById: jest.fn() };
    serviceRepository = { findById: jest.fn() };
    clientRepository = { findById: jest.fn() };
    scheduleBlockRepository = {
      findOverlapping: jest.fn().mockResolvedValue([]),
    };
    businessConfigRepository = { findByTenant: jest.fn() };
    tenantRepository = { findById: jest.fn() };
    now = new Date('2026-08-02T00:00:00.000Z');
    clock = { now: () => now };
    audit = { record: jest.fn() };
    notifications = { recordBooked: jest.fn().mockResolvedValue(undefined) };

    const reminders = { syncPreVisit: jest.fn().mockResolvedValue(undefined) };

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

    useCase = new BookAppointmentUseCase(
      appointmentRepository as unknown as AppointmentRepository,
      clientRepository as unknown as ClientRepository,
      new AppointmentSlotValidator(
        new ScheduleContextResolver(
          branchResolver as unknown as BranchResolver,
          professionalRepository as unknown as ProfessionalRepository,
          serviceRepository as unknown as ServiceRepository,
          branchServiceRepository as unknown as BranchServiceRepository,
          branchProfessionalRepository as unknown as BranchProfessionalRepository,
          {
            findActiveByAssignmentAndService: jest.fn().mockResolvedValue(null),
          } as never,
          businessConfigRepository as unknown as BusinessConfigRepository,
          tenantRepository as unknown as TenantRepository,
          clock,
        ),
        appointmentRepository as unknown as AppointmentRepository,
        scheduleBlockRepository as unknown as ScheduleBlockRepository,
      ),
      audit as unknown as AuditRecorder,
      { changed: jest.fn() } as unknown as AgendaEventPublisher,
      notifications as never,
      reminders as never,
      { run: (fn: () => Promise<unknown>) => fn() } as never,
    );

    clientRepository.findById.mockResolvedValue(
      new Client({
        id: 'c1',
        tenantId: 't1',
        name: 'María López',
        phoneE164: '+59170000001',
        notes: null,
      }),
    );
    professionalRepository.findById.mockResolvedValue(
      new Professional({
        id: 'p1',
        tenantId: 't1',
        name: 'Camila',
        isActive: true,
      }),
    );
    serviceRepository.findById.mockResolvedValue(
      new Service({
        id: 's1',
        tenantId: 't1',
        name: 'Limpieza',
        durationMinutes: 60,
        currency: Currency.BOB,
        price: '150.00',
        requiresDeposit: false,
        depositAmount: null,
        depositPercent: null,
        depositQrId: null,
        clientChoosesProfessional: true,
        isActive: true,
        professionalIds: ['p1'],
      }),
    );
    businessConfigRepository.findByTenant.mockResolvedValue(
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
    );
    tenantRepository.findById.mockResolvedValue(
      new Tenant({
        id: 't1',
        name: 'Estética Glow',
        timezone: 'UTC',
        status: TenantStatus.ACTIVE,
      }),
    );
  });

  it('books when the slot is free', async () => {
    const created = new Appointment({
      id: 'a1',
      tenantId: 't1',
      branchId: branch.id,
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T15:00:00.000Z'),
      endsAt: new Date('2026-08-03T16:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      price: Money.of('150.00', Currency.BOB),
    });
    appointmentRepository.create.mockResolvedValue(created);

    const result = await useCase.execute({
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: '2026-08-03T15:00:00.000Z',
    });

    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: branch.id,
        price: '150.00',
        currency: Currency.BOB,
      }),
    );
    expect(notifications.recordBooked).toHaveBeenCalledWith(created);
  });

  it('rejects an active overlap', async () => {
    appointmentRepository.findOverlapping.mockResolvedValue([
      new Appointment({
        id: 'a0',
        tenantId: 't1',
        branchId: branch.id,
        clientId: 'c2',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: new Date('2026-08-03T15:00:00.000Z'),
        endsAt: new Date('2026-08-03T16:00:00.000Z'),
        status: AppointmentStatus.CONFIRMED,
        price: Money.of('150.00', Currency.BOB),
      }),
    ]);

    await expect(
      useCase.execute({
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-03T15:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    expect(notifications.recordBooked).not.toHaveBeenCalled();
  });

  it('rejects inactive services', async () => {
    serviceRepository.findById.mockResolvedValue(
      new Service({
        id: 's1',
        tenantId: 't1',
        name: 'Limpieza',
        durationMinutes: 60,
        currency: Currency.BOB,
        price: '150.00',
        requiresDeposit: false,
        depositAmount: null,
        depositPercent: null,
        depositQrId: null,
        clientChoosesProfessional: true,
        isActive: false,
        professionalIds: ['p1'],
      }),
    );

    await expect(
      useCase.execute({
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-03T15:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('respects the configured minimum lead time', async () => {
    await expect(
      useCase.execute({
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-02T01:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('holds the lead time against the client channel', async () => {
    now = new Date('2026-08-03T14:00:00.000Z');

    await expect(
      useCase.execute(
        {
          clientId: 'c1',
          professionalId: 'p1',
          serviceId: 's1',
          startsAt: '2026-08-03T14:30:00.000Z',
        },
        BookingActor.CLIENT,
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('lets staff book inside the lead time window', async () => {
    now = new Date('2026-08-03T14:00:00.000Z');
    appointmentRepository.create.mockResolvedValue(
      new Appointment({
        id: 'a1',
        tenantId: 't1',
        branchId: branch.id,
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: new Date('2026-08-03T14:30:00.000Z'),
        endsAt: new Date('2026-08-03T15:30:00.000Z'),
        status: AppointmentStatus.CONFIRMED,
        price: Money.of('150.00', Currency.BOB),
      }),
    );

    const result = await useCase.execute(
      {
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-03T14:30:00.000Z',
      },
      BookingActor.STAFF,
    );

    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('still refuses a past slot to staff', async () => {
    now = new Date('2026-08-03T14:00:00.000Z');

    await expect(
      useCase.execute(
        {
          clientId: 'c1',
          professionalId: 'p1',
          serviceId: 's1',
          startsAt: '2026-08-03T13:00:00.000Z',
        },
        BookingActor.STAFF,
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('lets staff book shorter than the service catalog', async () => {
    appointmentRepository.create.mockImplementation(async (data) =>
      Promise.resolve(
        new Appointment({
          id: 'a1',
          tenantId: 't1',
          branchId: data.branchId!,
          clientId: data.clientId,
          professionalId: data.professionalId,
          serviceId: data.serviceId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: data.status,
          price: Money.of(data.price, data.currency),
        }),
      ),
    );

    const result = await useCase.execute(
      {
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-03T15:00:00.000Z',
        durationMinutes: 45,
      },
      BookingActor.STAFF,
    );

    expect(result.endsAt.toISOString()).toBe('2026-08-03T15:45:00.000Z');
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        endsAt: new Date('2026-08-03T15:45:00.000Z'),
      }),
    );
  });

  it('ignores a duration override from the client channel', async () => {
    appointmentRepository.create.mockImplementation(async (data) =>
      Promise.resolve(
        new Appointment({
          id: 'a1',
          tenantId: 't1',
          branchId: data.branchId!,
          clientId: data.clientId,
          professionalId: data.professionalId,
          serviceId: data.serviceId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: data.status,
          price: Money.of(data.price, data.currency),
        }),
      ),
    );

    const result = await useCase.execute(
      {
        clientId: 'c1',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: '2026-08-03T15:00:00.000Z',
        durationMinutes: 45,
      },
      BookingActor.CLIENT,
    );

    expect(result.endsAt.toISOString()).toBe('2026-08-03T16:00:00.000Z');
  });
});
