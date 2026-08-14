import { Inject, Injectable } from '@nestjs/common';

import { AccessibleBranchesResolver } from '@application/branches/services/accessible-branches.resolver';
import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

@Injectable()
export class ListBranchesUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    private readonly accessibleBranches: AccessibleBranchesResolver,
  ) {}

  async execute(activeOnly = false): Promise<Branch[]> {
    const branches = activeOnly
      ? await this.branchRepository.findActive()
      : await this.branchRepository.findAll();

    const allowedBranchIds = await this.accessibleBranches.forCurrentUser();
    if (!allowedBranchIds) {
      return branches;
    }

    const allowed = new Set(allowedBranchIds);
    return branches.filter((branch) => allowed.has(branch.id));
  }
}
