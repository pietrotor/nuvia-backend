import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';

import { CreateBranchDto } from '../dto/create-branch.dto';
import { slugifyBranchName } from '../services/branch-slug';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanCap } from '@domain/subscriptions/value-objects/plan-config.vo';

@Injectable()
export class CreateBranchUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    private readonly audit: AuditRecorder,
    private readonly entitlements: PlanEntitlements,
  ) {}

  async execute(dto: CreateBranchDto): Promise<Branch> {
    assertValidWeeklyHours(dto.weeklyHours);
    await this.entitlements.assertWithinCap(PlanCap.BRANCHES);

    const activeCount = await this.branchRepository.countActive();
    const makePrimary = activeCount === 0 || dto.isPrimary === true;

    if (makePrimary) {
      await this.demoteCurrentPrimary();
    }

    const created = await this.branchRepository.create({
      name: dto.name.trim(),
      slug: dto.slug?.trim() || slugifyBranchName(dto.name) || 'branch',
      address: dto.address ?? null,
      mapsUrl: dto.mapsUrl ?? null,
      phone: dto.phone ?? null,
      weeklyHours: dto.weeklyHours,
      timezone: dto.timezone ?? null,
      isPrimary: makePrimary,
    });

    await this.audit.record({
      action: AuditAction.BRANCH_CREATED,
      entity: 'branch',
      entityId: created.id,
      after: dto,
    });

    return created;
  }

  private async demoteCurrentPrimary(): Promise<void> {
    const current = await this.branchRepository.findPrimary();
    if (!current) return;

    await this.branchRepository.update(current.id, { isPrimary: false });
  }
}
