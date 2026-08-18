import { Inject, Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import {
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
  BranchProfessionalServiceWindowRepository,
} from '@domain/branches/repositories/branch-professional-service-window.repository';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import {
  EffectiveBranchService,
  resolveEffectiveBranchService,
} from '@domain/branches/services/effective-branch-service';
import {
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import { intersectWeeklyHours } from '@domain/business-config/services/weekly-hours';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import { Service } from '@domain/services/entities/service.entity';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { TenantNotFoundError } from '@domain/tenants/exceptions/tenant.exceptions';

export interface ScheduleContext {
  branch: Branch;
  service: Service;
  effectiveService: EffectiveBranchService;
  professional: Professional;
  branchProfessional: BranchProfessional;
  config: BusinessConfig;
  timezone: string;
  weeklyHours: WeeklyHours;
  /** Present when an active service offer window further restricts the schedule. */
  serviceWindowHours: WeeklyHours | null;
  earliestStartAt: Date;
}

// Gathers in one place everything that governs the schedule of a service with a
// professional at a branch: who can perform it there, during which hours, and from
// which moment on. Availability lookup and slot validation both use it, so the two
// answer with the same rules and nothing is ever offered that is later rejected.
@Injectable()
export class ScheduleContextResolver {
  constructor(
    private readonly branchResolver: BranchResolver,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY)
    private readonly serviceWindowRepository: BranchProfessionalServiceWindowRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  // The actor defaults to CLIENT so a caller that forgets it gets the stricter schedule
  // rather than a silent bypass of the lead time.
  async resolve(input: {
    serviceId: string;
    professionalId: string;
    branchId?: string;
    actor?: BookingActor;
  }): Promise<ScheduleContext> {
    const [branch, professional, service, config] = await Promise.all([
      this.branchResolver.resolve(input.branchId),
      this.professionalRepository.findById(input.professionalId),
      this.serviceRepository.findById(input.serviceId),
      this.businessConfigRepository.findByTenant(),
    ]);

    if (!professional) {
      throw new ProfessionalNotFoundError(input.professionalId);
    }
    if (!service) throw new ServiceNotFoundError(input.serviceId);
    if (!config) throw new BusinessConfigNotFoundError();

    // A deactivated service or professional simply has no schedule.
    if (!professional.isActive || !service.isActive) {
      throw new SlotUnavailableError();
    }

    /* A pairing the catalogue does not have is not an hour that got taken: naming it says
     * which of the two to change, and lets the panel keep it from being tried at all. */
    if (!service.professionalIds.includes(professional.id)) {
      throw new ProfessionalDoesNotPerformServiceError(
        professional.id,
        service.id,
      );
    }

    const [branchService, branchProfessional, serviceWindow] =
      await Promise.all([
        this.branchServiceRepository.findByBranchAndService(
          branch.id,
          service.id,
        ),
        this.branchProfessionalRepository.findByBranchAndProfessional(
          branch.id,
          professional.id,
        ),
        this.serviceWindowRepository.findActiveByAssignmentAndService(
          branch.id,
          professional.id,
          service.id,
        ),
      ]);

    if (!branchService || !branchService.isActive) {
      throw new ServiceNotOfferedAtBranchError(service.id, branch.id);
    }
    if (!branchProfessional || !branchProfessional.isActive) {
      throw new ProfessionalNotAtBranchError(professional.id, branch.id);
    }

    const baseHours = intersectWeeklyHours(
      branch.weeklyHours,
      branchProfessional.weeklyHours,
    );
    const serviceWindowHours = serviceWindow?.weeklyHours ?? null;
    const weeklyHours = serviceWindowHours
      ? intersectWeeklyHours(baseHours, serviceWindowHours)
      : baseHours;

    return {
      branch,
      service,
      effectiveService: resolveEffectiveBranchService(service, branchService),
      professional,
      branchProfessional,
      config,
      timezone: await this.timezoneFor(branch, config.tenantId),
      weeklyHours,
      serviceWindowHours,
      earliestStartAt: this.earliestStartFor(input.actor, config),
    };
  }

  private earliestStartFor(
    actor: BookingActor | undefined,
    config: BusinessConfig,
  ): Date {
    const now = this.clock.now();
    if (actor === BookingActor.STAFF) return now;

    return new Date(
      now.getTime() + config.bookingPolicy.minLeadTimeHours * 3_600_000,
    );
  }

  async tenantTimezone(): Promise<string> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();

    return this.timezoneFor(null, config.tenantId);
  }

  private async timezoneFor(
    branch: Branch | null,
    tenantId: string,
  ): Promise<string> {
    if (branch?.timezone) return branch.timezone;

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new TenantNotFoundError(tenantId);

    return tenant.timezone;
  }
}
