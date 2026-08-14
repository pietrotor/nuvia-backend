import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import {
  BranchNotFoundError,
  ProfessionalNotAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';

import { UpdateBranchProfessionalDto } from '../dto/update-branch-professional.dto';

@Injectable()
export class UpdateBranchProfessionalUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    branchId: string,
    professionalId: string,
    dto: UpdateBranchProfessionalDto,
  ): Promise<BranchProfessional> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const current =
      await this.branchProfessionalRepository.findByBranchAndProfessional(
        branchId,
        professionalId,
      );
    if (!current) {
      throw new ProfessionalNotAtBranchError(professionalId, branchId);
    }

    if (dto.weeklyHours) {
      assertValidWeeklyHours(dto.weeklyHours);
    }

    const updated =
      dto.isActive === false
        ? await this.branchProfessionalRepository.deactivate(
            branchId,
            professionalId,
          )
        : await this.branchProfessionalRepository.upsert({
            branchId,
            professionalId,
            weeklyHours: dto.weeklyHours ?? current.weeklyHours,
            isActive: dto.isActive ?? current.isActive,
          });

    if (!updated) {
      throw new ProfessionalNotAtBranchError(professionalId, branchId);
    }

    await this.audit.record({
      action: AuditAction.BRANCH_PROFESSIONAL_UPDATED,
      entity: 'branch_professional',
      entityId: `${branchId}:${professionalId}`,
      before: current,
      after: dto,
    });

    return updated;
  }
}
