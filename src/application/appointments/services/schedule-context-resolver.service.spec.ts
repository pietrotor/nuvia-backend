import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import {
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import { BranchProfessionalRepository } from '@domain/branches/repositories/branch-professional.repository';
import { BranchProfessionalServiceWindowRepository } from '@domain/branches/repositories/branch-professional-service-window.repository';
import { BranchServiceRepository } from '@domain/branches/repositories/branch-service.repository';
import {
  AgentTone,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { ScheduleContextResolver } from './schedule-context-resolver.service';

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
  timezone: 'America/La_Paz',
  isPrimary: true,
  isActive: true,
});

const professional = (isActive = true) =>
  new Professional({ id: 'p1', tenantId: 't1', name: 'Camila', isActive });

const service = (
  overrides: { isActive?: boolean; performedBy?: string[] } = {},
) =>
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
    isActive: overrides.isActive ?? true,
    professionalIds: overrides.performedBy ?? ['p1'],
  });

const branchService = (isActive = true) =>
  new BranchService({
    tenantId: 't1',
    branchId: branch.id,
    serviceId: 's1',
    priceOverrideAmount: null,
    depositAmountOverrideAmount: null,
    depositQrId: null,
    isActive,
  });

const branchProfessional = (isActive = true) =>
  new BranchProfessional({
    tenantId: 't1',
    branchId: branch.id,
    professionalId: 'p1',
    weeklyHours: hours,
    isActive,
  });

describe('ScheduleContextResolver', () => {
  let professionalRepository: jest.Mocked<
    Pick<ProfessionalRepository, 'findById'>
  >;
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let branchServiceRepository: jest.Mocked<
    Pick<BranchServiceRepository, 'findByBranchAndService'>
  >;
  let branchProfessionalRepository: jest.Mocked<
    Pick<BranchProfessionalRepository, 'findByBranchAndProfessional'>
  >;
  let resolver: ScheduleContextResolver;

  const resolve = () =>
    resolver.resolve({
      serviceId: 's1',
      professionalId: 'p1',
      branchId: branch.id,
      actor: BookingActor.STAFF,
    });

  beforeEach(() => {
    professionalRepository = {
      findById: jest.fn().mockResolvedValue(professional()),
    };
    serviceRepository = { findById: jest.fn().mockResolvedValue(service()) };
    branchServiceRepository = {
      findByBranchAndService: jest.fn().mockResolvedValue(branchService()),
    };
    branchProfessionalRepository = {
      findByBranchAndProfessional: jest
        .fn()
        .mockResolvedValue(branchProfessional()),
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

    resolver = new ScheduleContextResolver(
      {
        resolve: jest.fn().mockResolvedValue(branch),
      } as unknown as BranchResolver,
      professionalRepository as unknown as ProfessionalRepository,
      serviceRepository as unknown as ServiceRepository,
      branchServiceRepository as unknown as BranchServiceRepository,
      branchProfessionalRepository as unknown as BranchProfessionalRepository,
      {
        findActiveByAssignmentAndService: jest.fn().mockResolvedValue(null),
      } as unknown as BranchProfessionalServiceWindowRepository,
      businessConfigRepository as unknown as BusinessConfigRepository,
      tenantRepository as unknown as TenantRepository,
      clock,
    );
  });

  it('resolves the schedule of a pairing the business does offer', async () => {
    const context = await resolve();

    expect(context.branch.id).toBe(branch.id);
    expect(context.professional.id).toBe('p1');
    expect(context.timezone).toBe('America/La_Paz');
    expect(context.weeklyHours.mon).toEqual({ start: '09:00', end: '18:00' });
    expect(context.serviceWindowHours).toBeNull();
  });

  /* Telling this apart from an hour that got taken is what lets the panel keep the move
   * from being attempted, and the agent say which of the two has to change. */
  it('names the pairing when the catalogue does not have it', async () => {
    serviceRepository.findById.mockResolvedValue(
      service({ performedBy: ['p2'] }),
    );

    await expect(resolve()).rejects.toBeInstanceOf(
      ProfessionalDoesNotPerformServiceError,
    );
  });

  it('treats somebody deactivated as having no schedule', async () => {
    professionalRepository.findById.mockResolvedValue(professional(false));

    await expect(resolve()).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('treats a retired service as having no schedule', async () => {
    serviceRepository.findById.mockResolvedValue(service({ isActive: false }));

    await expect(resolve()).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('refuses a service the branch does not offer', async () => {
    branchServiceRepository.findByBranchAndService.mockResolvedValue(
      branchService(false),
    );

    await expect(resolve()).rejects.toBeInstanceOf(
      ServiceNotOfferedAtBranchError,
    );
  });

  it('refuses somebody who does not attend at the branch', async () => {
    branchProfessionalRepository.findByBranchAndProfessional.mockResolvedValue(
      null,
    );

    await expect(resolve()).rejects.toBeInstanceOf(
      ProfessionalNotAtBranchError,
    );
  });

  it('reports who and what is missing before anything else', async () => {
    professionalRepository.findById.mockResolvedValue(null);
    await expect(resolve()).rejects.toBeInstanceOf(ProfessionalNotFoundError);

    professionalRepository.findById.mockResolvedValue(professional());
    serviceRepository.findById.mockResolvedValue(null);
    await expect(resolve()).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('holds the lead time against a client and not against the counter', async () => {
    const staff = await resolve();
    const client = await resolver.resolve({
      serviceId: 's1',
      professionalId: 'p1',
      branchId: branch.id,
      actor: BookingActor.CLIENT,
    });

    expect(staff.earliestStartAt).toEqual(new Date('2026-08-02T00:00:00.000Z'));
    expect(client.earliestStartAt).toEqual(
      new Date('2026-08-02T02:00:00.000Z'),
    );
  });
});
