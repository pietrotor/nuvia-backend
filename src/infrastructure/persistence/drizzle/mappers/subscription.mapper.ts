import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { Plan } from '@domain/subscriptions/entities/plan.entity';
import { Subscription } from '@domain/subscriptions/entities/subscription.entity';
import { parsePartialPlanConfig } from '@domain/subscriptions/value-objects/plan-config.vo';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';

import { PlanSchema } from '../schema/plan.schema';
import { SubscriptionSchema } from '../schema/subscription.schema';
import { PlanMapper } from './plan.mapper';

export class SubscriptionMapper {
  static toDomain(
    row: SubscriptionSchema,
    plan: Plan | PlanSchema | null = null,
  ): Subscription {
    return new Subscription({
      id: row.id,
      tenantId: row.tenantId,
      planId: row.planId,
      status: row.status as SubscriptionStatus,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      configOverrides:
        row.configOverrides === null || row.configOverrides === undefined
          ? null
          : parsePartialPlanConfig(row.configOverrides),
      price: Money.of(row.priceAmount, row.priceCurrency as Currency),
      notes: row.notes,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      plan: plan
        ? plan instanceof Plan
          ? plan
          : PlanMapper.toDomain(plan)
        : null,
    });
  }
}
