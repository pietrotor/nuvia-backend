import { Inject, Injectable } from '@nestjs/common';

import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
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
  service: Service;
  professional: Professional;
  config: BusinessConfig;
  timezone: string;
  weeklyHours: WeeklyHours;
  earliestStartAt: Date;
}

// Gathers in one place everything that governs the schedule of a service with a
// professional: who can perform it, during which hours, and from which moment on.
// Availability lookup and slot validation both use it, so the two answer with the
// same rules and nothing is ever offered that is later rejected.
@Injectable()
export class ScheduleContextResolver {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async resolve(input: {
    serviceId: string;
    professionalId: string;
  }): Promise<ScheduleContext> {
    const [professional, service, config] = await Promise.all([
      this.professionalRepository.findById(input.professionalId),
      this.serviceRepository.findById(input.serviceId),
      this.businessConfigRepository.findByTenant(),
    ]);

    if (!professional) {
      throw new ProfessionalNotFoundError(input.professionalId);
    }
    if (!service) throw new ServiceNotFoundError(input.serviceId);
    if (!config) throw new BusinessConfigNotFoundError();

    // A deactivated service or professional, or a combination the business does
    // not offer, simply has no schedule.
    if (
      !professional.isActive ||
      !service.isActive ||
      !service.professionalIds.includes(professional.id)
    ) {
      throw new SlotUnavailableError();
    }

    return {
      service,
      professional,
      config,
      timezone: await this.timezoneFor(config),
      weeklyHours: intersectWeeklyHours(
        config.businessHours,
        professional.weeklyHours,
      ),
      earliestStartAt: new Date(
        this.clock.now().getTime() +
          config.bookingPolicy.minLeadTimeHours * 3_600_000,
      ),
    };
  }

  async tenantTimezone(): Promise<string> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();

    return this.timezoneFor(config);
  }

  private async timezoneFor(config: BusinessConfig): Promise<string> {
    const tenant = await this.tenantRepository.findById(config.tenantId);
    if (!tenant) throw new TenantNotFoundError(config.tenantId);

    return tenant.timezone;
  }
}
