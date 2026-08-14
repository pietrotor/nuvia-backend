import { Global, Module } from '@nestjs/common';

import { PlanEntitlements } from './services/plan-entitlements.service';
import { CreatePlanUseCase } from './use-cases/create-plan.use-case';
import { UpdatePlanUseCase } from './use-cases/update-plan.use-case';
import { ListPlansUseCase } from './use-cases/list-plans.use-case';
import { CreateSubscriptionUseCase } from './use-cases/create-subscription.use-case';
import { RenewSubscriptionUseCase } from './use-cases/renew-subscription.use-case';
import { ChangeSubscriptionPlanUseCase } from './use-cases/change-subscription-plan.use-case';
import { UpdateSubscriptionUseCase } from './use-cases/update-subscription.use-case';
import { GetMySubscriptionUseCase } from './use-cases/get-my-subscription.use-case';
import { EnsureTrialSubscriptionUseCase } from './use-cases/ensure-trial-subscription.use-case';

@Global()
@Module({
  providers: [
    PlanEntitlements,
    CreatePlanUseCase,
    UpdatePlanUseCase,
    ListPlansUseCase,
    CreateSubscriptionUseCase,
    RenewSubscriptionUseCase,
    ChangeSubscriptionPlanUseCase,
    UpdateSubscriptionUseCase,
    GetMySubscriptionUseCase,
    EnsureTrialSubscriptionUseCase,
  ],
  exports: [
    PlanEntitlements,
    CreatePlanUseCase,
    UpdatePlanUseCase,
    ListPlansUseCase,
    CreateSubscriptionUseCase,
    RenewSubscriptionUseCase,
    ChangeSubscriptionPlanUseCase,
    UpdateSubscriptionUseCase,
    GetMySubscriptionUseCase,
    EnsureTrialSubscriptionUseCase,
  ],
})
export class SubscriptionsModule {}
