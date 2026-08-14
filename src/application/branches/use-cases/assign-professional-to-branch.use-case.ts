import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';

import { AssignProfessionalToBranchDto } from '../dto/assign-professional-to-branch.dto';

@Injectable()
export class AssignProfessionalToBranchUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    branchId: string,
    professionalId: string,
    dto: AssignProfessionalToBranchDto,
  ): Promise<BranchProfessional> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const professional =
      await this.professionalRepository.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    assertValidWeeklyHours(dto.weeklyHours);

    const assigned = await this.branchProfessionalRepository.upsert({
      branchId,
      professionalId,
      weeklyHours: dto.weeklyHours,
      isActive: dto.isActive ?? true,
    });

    await this.audit.record({
      action: AuditAction.BRANCH_PROFESSIONAL_ASSIGNED,
      entity: 'branch_professional',
      entityId: `${branchId}:${professionalId}`,
      after: dto,
    });

    return assigned;
  }
}
