import { Global, Module } from '@nestjs/common';

import { AccessibleBranchesResolver } from '@application/branches/services/accessible-branches.resolver';
import { BranchResolver } from '@application/branches/services/branch-resolver.service';

@Global()
@Module({
  providers: [BranchResolver, AccessibleBranchesResolver],
  exports: [BranchResolver, AccessibleBranchesResolver],
})
export class BranchesModule {}
