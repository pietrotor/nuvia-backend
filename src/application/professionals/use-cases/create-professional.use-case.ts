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
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanCap } from '@domain/subscriptions/value-objects/plan-config.vo';
import { CreateProfessionalDto } from '../dto/create-professional.dto';

@Injectable()
export class CreateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    private readonly audit: AuditRecorder,
    private readonly entitlements: PlanEntitlements,
  ) {}

  async execute(dto: CreateProfessionalDto): Promise<Professional> {
    assertValidWeeklyHours(dto.weeklyHours);
    await this.entitlements.assertWithinCap(PlanCap.PROFESSIONALS);

    const primary = await this.branchRepository.findPrimary();
    if (!primary) throw new BranchNotFoundError('');

    const created = await this.professionalRepository.create({
      name: dto.name.trim(),
      isActive: dto.isActive,
    });

    // Panel still sends weeklyHours on create; hours now live on branch_professionals.
    await this.branchProfessionalRepository.upsert({
      branchId: primary.id,
      professionalId: created.id,
      weeklyHours: dto.weeklyHours,
    });

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_CREATED,
      entity: 'professional',
      entityId: created.id,
      after: dto,
    });

    return created;
  }
}
