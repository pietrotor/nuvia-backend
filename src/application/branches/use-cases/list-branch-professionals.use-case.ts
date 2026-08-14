import { Inject, Injectable } from '@nestjs/common';

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

@Injectable()
export class ListBranchProfessionalsUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
  ) {}

  async execute(
    branchId: string,
    activeOnly = false,
  ): Promise<BranchProfessional[]> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    if (activeOnly) {
      return this.branchProfessionalRepository.findActiveByBranch(branchId);
    }
    return this.branchProfessionalRepository.findByBranch(branchId);
  }
}
