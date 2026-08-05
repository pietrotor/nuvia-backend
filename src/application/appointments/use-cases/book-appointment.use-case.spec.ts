import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { BookAppointmentUseCase } from './book-appointment.use-case';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
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
  let clock: ClockPort;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
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
    clock = { now: () => new Date('2026-08-02T00:00:00.000Z') };
    audit = { record: jest.fn() };

    useCase = new BookAppointmentUseCase(
      appointmentRepository as unknown as AppointmentRepository,
      clientRepository as unknown as ClientRepository,
      new AppointmentSlotValidator(
        new ScheduleContextResolver(
          professionalRepository as unknown as ProfessionalRepository,
          serviceRepository as unknown as ServiceRepository,
          businessConfigRepository as unknown as BusinessConfigRepository,
          tenantRepository as unknown as TenantRepository,
          clock,
        ),
        appointmentRepository as unknown as AppointmentRepository,
        scheduleBlockRepository as unknown as ScheduleBlockRepository,
      ),
      audit as unknown as AuditRecorder,
    );

    clientRepository.findById.mockResolvedValue(
      new Client({
        id: 'c1',
        tenantId: 't1',
        name: 'Cliente',
        phoneE164: '+59170000001',
        notes: null,
      }),
    );
    professionalRepository.findById.mockResolvedValue(
      new Professional({
        id: 'p1',
        tenantId: 't1',
        name: 'Camila',
        weeklyHours: hours,
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
        businessHours: hours,
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
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T15:00:00.000Z'),
      endsAt: new Date('2026-08-03T16:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
    });
    appointmentRepository.create.mockResolvedValue(created);

    const result = await useCase.execute({
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: '2026-08-03T15:00:00.000Z',
    });

    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    expect(appointmentRepository.create).toHaveBeenCalled();
  });

  it('rejects an active overlap', async () => {
    appointmentRepository.findOverlapping.mockResolvedValue([
      new Appointment({
        id: 'a0',
        tenantId: 't1',
        clientId: 'c2',
        professionalId: 'p1',
        serviceId: 's1',
        startsAt: new Date('2026-08-03T15:00:00.000Z'),
        endsAt: new Date('2026-08-03T16:00:00.000Z'),
        status: AppointmentStatus.CONFIRMED,
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
});
