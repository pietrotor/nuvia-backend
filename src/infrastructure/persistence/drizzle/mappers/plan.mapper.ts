import { Plan } from '@domain/subscriptions/entities/plan.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { parsePartialPlanConfig } from '@domain/subscriptions/value-objects/plan-config.vo';

import { PlanSchema } from '../schema/plan.schema';

export class PlanMapper {
  static toDomain(row: PlanSchema): Plan {
    return new Plan({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.isActive,
      price: Money.of(row.priceAmount, row.priceCurrency as Currency),
      billingPeriodMonths: row.billingPeriodMonths,
      config: parsePartialPlanConfig(row.config),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
