import { Inject, Injectable } from '@nestjs/common';

import { BranchService } from '@domain/branches/entities/branch-service.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

@Injectable()
export class ListBranchServicesUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
  ) {}

  async execute(
    branchId: string,
    activeOnly = false,
  ): Promise<BranchService[]> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    if (activeOnly) {
      return this.branchServiceRepository.findActiveByBranch(branchId);
    }
    return this.branchServiceRepository.findByBranch(branchId);
  }
}
