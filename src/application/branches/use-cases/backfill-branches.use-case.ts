import { Inject, Injectable } from '@nestjs/common';

import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';

const PRIMARY_BRANCH_NAME = 'Casa Matriz';
const PRIMARY_BRANCH_SLUG = 'casa-matriz';

const DEFAULT_BRANCH_HOURS: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

export interface BackfillBranchesResult {
  tenantsProcessed: number;
  tenantsSkippedMissingConfig: number;
  branchesCreated: number;
}

/**
 * Idempotent migration helper: ensures every tenant has a primary branch and
 * links existing rows (professionals, services, appointments, blocks, QRs,
 * conversations) to it.
 *
 * Safe to re-run after phase-2 (legacy address/hours columns dropped): new
 * primary branches get default hours; professional assignments inherit the
 * branch's weekly hours when linking for the first time.
 */
@Injectable()
export class BackfillBranchesUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<BackfillBranchesResult> {
    const tenants = await this.tenantRepository.findAll();
    let tenantsProcessed = 0;
    let tenantsSkippedMissingConfig = 0;
    let branchesCreated = 0;

    for (const tenant of tenants) {
      await this.tenantContext.runWithTenant(tenant.id, async () => {
        const config = await this.businessConfigRepository.findByTenant();
        if (!config) {
          this.logger.warn(
            `Skipping tenant ${tenant.id} (${tenant.name}): missing business_config`,
            BackfillBranchesUseCase.name,
          );
          tenantsSkippedMissingConfig += 1;
          return;
        }

        let primary = await this.branchRepository.findPrimary();
        if (!primary) {
          primary = await this.branchRepository.create({
            name: PRIMARY_BRANCH_NAME,
            slug: PRIMARY_BRANCH_SLUG,
            address: null,
            weeklyHours: DEFAULT_BRANCH_HOURS,
            isPrimary: true,
            isActive: true,
          });
          branchesCreated += 1;
        }

        await this.linkProfessionals(primary);
        await this.linkActiveServices(primary.id);
        await this.appointmentRepository.backfillBranchAndPriceSnapshots(
          primary.id,
        );
        await this.scheduleBlockRepository.assignBranchToAllWithoutBranch(
          primary.id,
        );
        await this.depositQrRepository.assignBranchToAllWithoutBranch(
          primary.id,
        );
        await this.conversationRepository.assignBranchToAllWithoutBranch(
          primary.id,
        );

        tenantsProcessed += 1;
      });
    }

    return {
      tenantsProcessed,
      tenantsSkippedMissingConfig,
      branchesCreated,
    };
  }

  private async linkProfessionals(primary: Branch): Promise<void> {
    const professionals = await this.professionalRepository.findAll();
    for (const professional of professionals) {
      const existing =
        await this.branchProfessionalRepository.findByBranchAndProfessional(
          primary.id,
          professional.id,
        );
      if (existing) continue;

      await this.branchProfessionalRepository.upsert({
        branchId: primary.id,
        professionalId: professional.id,
        weeklyHours: primary.weeklyHours,
      });
    }
  }

  private async linkActiveServices(branchId: string): Promise<void> {
    const services = await this.serviceRepository.findAll();
    for (const service of services) {
      if (!service.isActive) continue;

      const existing =
        await this.branchServiceRepository.findByBranchAndService(
          branchId,
          service.id,
        );
      if (existing) continue;

      await this.branchServiceRepository.upsert({
        branchId,
        serviceId: service.id,
      });
    }
  }
}
