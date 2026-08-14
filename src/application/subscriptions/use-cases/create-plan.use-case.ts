import { Inject, Injectable } from '@nestjs/common';

import { Money } from '@domain/common/value-objects/money.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Plan } from '@domain/subscriptions/entities/plan.entity';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '@domain/subscriptions/repositories/plan.repository';
import { PlanCodeAlreadyExistsError } from '@domain/subscriptions/exceptions/subscription.exceptions';
import {
  PartialPlanConfig,
  parsePartialPlanConfig,
} from '@domain/subscriptions/value-objects/plan-config.vo';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

export interface CreatePlanInput {
  code: string;
  name: string;
  isActive?: boolean;
  priceAmount: string;
  priceCurrency?: Currency;
  billingPeriodMonths?: number;
  config?: PartialPlanConfig;
}

@Injectable()
export class CreatePlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: CreatePlanInput): Promise<Plan> {
    const code = input.code.trim().toLowerCase();
    if (await this.plans.findByCode(code)) {
      throw new PlanCodeAlreadyExistsError(code);
    }

    const config = parsePartialPlanConfig(input.config ?? {});
    const created = await this.plans.create({
      code,
      name: input.name.trim(),
      isActive: input.isActive ?? true,
      price: Money.of(input.priceAmount, input.priceCurrency ?? Currency.BOB),
      billingPeriodMonths: input.billingPeriodMonths ?? 1,
      config,
    });

    await this.audit.record({
      action: AuditAction.PLAN_UPDATED,
      entity: 'plan',
      entityId: created.id,
      after: { code: created.code, name: created.name, config },
    });

    return created;
  }
}
