import { Inject, Injectable } from '@nestjs/common';

import { Money } from '@domain/common/value-objects/money.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Plan } from '@domain/subscriptions/entities/plan.entity';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '@domain/subscriptions/repositories/plan.repository';
import { PlanNotFoundError } from '@domain/subscriptions/exceptions/subscription.exceptions';
import {
  PartialPlanConfig,
  parsePartialPlanConfig,
} from '@domain/subscriptions/value-objects/plan-config.vo';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

export interface UpdatePlanInput {
  name?: string;
  isActive?: boolean;
  priceAmount?: string;
  priceCurrency?: Currency;
  billingPeriodMonths?: number;
  config?: PartialPlanConfig;
}

@Injectable()
export class UpdatePlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, input: UpdatePlanInput): Promise<Plan> {
    const current = await this.plans.findById(id);
    if (!current) throw new PlanNotFoundError(id);

    const config =
      input.config !== undefined
        ? parsePartialPlanConfig(input.config)
        : undefined;

    const updated = await this.plans.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.priceAmount !== undefined
        ? {
            price: Money.of(
              input.priceAmount,
              input.priceCurrency ?? current.price.currency,
            ),
          }
        : {}),
      ...(input.billingPeriodMonths !== undefined
        ? { billingPeriodMonths: input.billingPeriodMonths }
        : {}),
      ...(config !== undefined ? { config } : {}),
    });

    if (!updated) throw new PlanNotFoundError(id);

    await this.audit.record({
      action: AuditAction.PLAN_UPDATED,
      entity: 'plan',
      entityId: id,
      before: {
        name: current.name,
        isActive: current.isActive,
        config: current.config,
      },
      after: input,
    });

    return updated;
  }
}
