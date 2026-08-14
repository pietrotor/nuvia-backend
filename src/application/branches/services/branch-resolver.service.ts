import { Inject, Injectable } from '@nestjs/common';

import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BranchNotFoundError,
  BranchRequiredError,
} from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

// Resolves which branch a schedule or booking operates on: an explicit id, or the
// only active branch when the tenant has not gone multi-location yet.
@Injectable()
export class BranchResolver {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
  ) {}

  async resolve(optionalBranchId?: string): Promise<Branch> {
    if (optionalBranchId) {
      const branch = await this.branchRepository.findById(optionalBranchId);
      if (!branch || !branch.isActive) {
        throw new BranchNotFoundError(optionalBranchId);
      }
      return branch;
    }

    const active = await this.branchRepository.findActive();
    if (active.length === 0) throw new BranchNotFoundError('');
    if (active.length > 1) throw new BranchRequiredError();
    return active[0];
  }
}
