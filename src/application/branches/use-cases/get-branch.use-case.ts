import { Inject, Injectable } from '@nestjs/common';

import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

@Injectable()
export class GetBranchUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
  ) {}

  async execute(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findById(id);
    if (!branch) throw new BranchNotFoundError(id);
    return branch;
  }
}
