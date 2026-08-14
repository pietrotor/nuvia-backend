import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
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
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { UpdateProfessionalDto } from '../dto/update-professional.dto';

@Injectable()
export class UpdateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateProfessionalDto): Promise<Professional> {
    const current = await this.professionalRepository.findById(id);
    if (!current) throw new ProfessionalNotFoundError(id);

    if (dto.weeklyHours) {
      assertValidWeeklyHours(dto.weeklyHours);
    }

    const data = {
      name: dto.name?.trim(),
      isActive: dto.isActive,
    };
    const updated = await this.professionalRepository.update(id, data);
    if (!updated) throw new ProfessionalNotFoundError(id);

    // Prefer primary only until the panel manages per-branch hours via branch endpoints.
    if (dto.weeklyHours) {
      const primary = await this.branchRepository.findPrimary();
      if (!primary) throw new BranchNotFoundError('');

      await this.branchProfessionalRepository.upsert({
        branchId: primary.id,
        professionalId: id,
        weeklyHours: dto.weeklyHours,
      });
    }

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_UPDATED,
      entity: 'professional',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }
}
