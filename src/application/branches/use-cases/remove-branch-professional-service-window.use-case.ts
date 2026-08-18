import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';
import {
  BranchNotFoundError,
  ServiceOfferWindowNotFoundError,
} from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
  BranchProfessionalServiceWindowRepository,
} from '@domain/branches/repositories/branch-professional-service-window.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

@Injectable()
export class RemoveBranchProfessionalServiceWindowUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY)
    private readonly serviceWindowRepository: BranchProfessionalServiceWindowRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const existing =
      await this.serviceWindowRepository.findByAssignmentAndService(
        branchId,
        professionalId,
        serviceId,
      );
    if (!existing) {
      throw new ServiceOfferWindowNotFoundError(
        branchId,
        professionalId,
        serviceId,
      );
    }

    const deactivated = await this.serviceWindowRepository.deactivate(
      branchId,
      professionalId,
      serviceId,
    );
    if (!deactivated) {
      throw new ServiceOfferWindowNotFoundError(
        branchId,
        professionalId,
        serviceId,
      );
    }

    await this.audit.record({
      action: AuditAction.BRANCH_PROFESSIONAL_SERVICE_WINDOW_REMOVED,
      entity: 'branch_professional_service_window',
      entityId: `${branchId}:${professionalId}:${serviceId}`,
      before: { isActive: existing.isActive },
      after: { isActive: false },
    });

    return deactivated;
  }
}
