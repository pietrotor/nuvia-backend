import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';
import {
  BranchNotFoundError,
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
  ServiceOfferWindowEmptyError,
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
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';
import {
  hasAnyOpenDay,
  intersectWeeklyHours,
} from '@domain/business-config/services/weekly-hours';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';

import { UpsertBranchProfessionalServiceWindowDto } from '../dto/upsert-branch-professional-service-window.dto';

@Injectable()
export class UpsertBranchProfessionalServiceWindowUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY)
    private readonly serviceWindowRepository: BranchProfessionalServiceWindowRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    branchId: string,
    professionalId: string,
    serviceId: string,
    dto: UpsertBranchProfessionalServiceWindowDto,
  ): Promise<BranchProfessionalServiceWindow> {
    assertValidWeeklyHours(dto.weeklyHours);

    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const service = await this.serviceRepository.findById(serviceId);
    if (!service) throw new ServiceNotFoundError(serviceId);

    if (!service.professionalIds.includes(professionalId)) {
      throw new ProfessionalDoesNotPerformServiceError(
        professionalId,
        serviceId,
      );
    }

    const [assignment, branchService] = await Promise.all([
      this.branchProfessionalRepository.findByBranchAndProfessional(
        branchId,
        professionalId,
      ),
      this.branchServiceRepository.findByBranchAndService(branchId, serviceId),
    ]);

    if (!assignment || !assignment.isActive) {
      throw new ProfessionalNotAtBranchError(professionalId, branchId);
    }
    if (!branchService || !branchService.isActive) {
      throw new ServiceNotOfferedAtBranchError(serviceId, branchId);
    }

    const baseHours = intersectWeeklyHours(
      branch.weeklyHours,
      assignment.weeklyHours,
    );
    const effective = intersectWeeklyHours(baseHours, dto.weeklyHours);
    if (!hasAnyOpenDay(effective)) {
      throw new ServiceOfferWindowEmptyError();
    }

    const window = await this.serviceWindowRepository.upsert({
      branchId,
      professionalId,
      serviceId,
      weeklyHours: dto.weeklyHours,
      isActive: dto.isActive ?? true,
    });

    await this.audit.record({
      action: AuditAction.BRANCH_PROFESSIONAL_SERVICE_WINDOW_UPSERTED,
      entity: 'branch_professional_service_window',
      entityId: `${branchId}:${professionalId}:${serviceId}`,
      after: dto,
    });

    return window;
  }
}
