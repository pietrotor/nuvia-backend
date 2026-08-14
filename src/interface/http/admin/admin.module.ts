import { Module } from '@nestjs/common';

import { BackfillBranchesUseCase } from '@application/branches/use-cases/backfill-branches.use-case';
import { AdminController } from './admin.controller';
import { SubscriptionsAdminController } from './subscriptions-admin.controller';

@Module({
  controllers: [AdminController, SubscriptionsAdminController],
  providers: [BackfillBranchesUseCase],
})
export class AdminModule {}
