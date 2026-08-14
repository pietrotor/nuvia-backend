import { Inject, Injectable } from '@nestjs/common';

import {
  USER_BRANCH_REPOSITORY,
  UserBranchRepository,
} from '@domain/branches/repositories/user-branch.repository';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

// Resolves which branches the current user may see. null = whole tenant (no
// user_branches rows yet — today's owner/staff behaviour). A list = only those ids.
@Injectable()
export class AccessibleBranchesResolver {
  constructor(
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(USER_BRANCH_REPOSITORY)
    private readonly userBranches: UserBranchRepository,
  ) {}

  async forCurrentUser(): Promise<string[] | null> {
    const userId = this.tenantContext.userId;
    if (!userId) {
      return null;
    }

    const branchIds = await this.userBranches.findBranchIdsByUser(userId);
    if (branchIds.length === 0) {
      return null;
    }

    return branchIds;
  }
}
