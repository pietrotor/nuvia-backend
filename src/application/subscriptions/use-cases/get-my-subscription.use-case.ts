import { Inject, Injectable } from '@nestjs/common';

import {
  AGENT_USAGE_VIEW_REPOSITORY,
  AgentUsageViewRepository,
} from '@domain/subscriptions/repositories/agent-usage.view-repository';
import {
  PLAN_USAGE_VIEW_REPOSITORY,
  PlanUsageViewRepository,
} from '@domain/subscriptions/repositories/plan-usage.view-repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import { SubscriptionNotFoundError } from '@domain/subscriptions/exceptions/subscription.exceptions';
import {
  PlanCap,
  PlanConfig,
  PlanQuota,
} from '@domain/subscriptions/value-objects/plan-config.vo';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import { Money } from '@domain/common/value-objects/money.vo';

export interface UsageMeter {
  key: string;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface MySubscriptionResult {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  price: Money;
  plan: { id: string; code: string; name: string };
  config: PlanConfig;
  quotas: UsageMeter[];
  caps: UsageMeter[];
  features: PlanConfig['features'];
}

@Injectable()
export class GetMySubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(AGENT_USAGE_VIEW_REPOSITORY)
    private readonly agentUsage: AgentUsageViewRepository,
    @Inject(PLAN_USAGE_VIEW_REPOSITORY)
    private readonly planUsage: PlanUsageViewRepository,
  ) {}

  async execute(): Promise<MySubscriptionResult> {
    const subscription = await this.subscriptions.findCurrentWithPlan();
    if (!subscription || !subscription.plan) {
      throw new SubscriptionNotFoundError();
    }

    const config = subscription.effectiveConfig();
    const aiRepliesUsed = await this.agentUsage.countAgentRepliesBetween({
      from: subscription.currentPeriodStart,
      to: subscription.currentPeriodEnd,
    });
    const capsUsed = await this.planUsage.currentCounts();

    const aiLimit = config.quotas.aiRepliesPerPeriod;

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      price: subscription.price,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
      },
      config,
      quotas: [
        {
          key: PlanQuota.AI_REPLIES_PER_PERIOD,
          used: aiRepliesUsed,
          limit: aiLimit,
          remaining:
            aiLimit === null ? null : Math.max(0, aiLimit - aiRepliesUsed),
        },
      ],
      caps: Object.values(PlanCap).map((key) => {
        const limit = config.caps[key];
        const used = capsUsed[key];
        return {
          key,
          used,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - used),
        };
      }),
      features: config.features,
    };
  }
}
