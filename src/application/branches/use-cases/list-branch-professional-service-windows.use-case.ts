import { Inject, Injectable } from '@nestjs/common';

import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
  BranchProfessionalServiceWindowRepository,
} from '@domain/branches/repositories/branch-professional-service-window.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';

@Injectable()
export class ListBranchProfessionalServiceWindowsUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY)
    private readonly serviceWindowRepository: BranchProfessionalServiceWindowRepository,
  ) {}

  async execute(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessionalServiceWindow[]> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    return this.serviceWindowRepository.findByAssignment(
      branchId,
      professionalId,
    );
  }
}
