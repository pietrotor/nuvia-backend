import { Inject, Injectable } from '@nestjs/common';

import { ValidationError } from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/exceptions/error-code';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { Subscription } from '@domain/subscriptions/entities/subscription.entity';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '@domain/subscriptions/repositories/plan.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import {
  PlanNotFoundError,
  SubscriptionAlreadyExistsError,
} from '@domain/subscriptions/exceptions/subscription.exceptions';
import {
  PartialPlanConfig,
  parsePartialPlanConfig,
} from '@domain/subscriptions/value-objects/plan-config.vo';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

export interface CreateSubscriptionInput {
  tenantId: string;
  planId: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  configOverrides?: PartialPlanConfig | null;
  notes?: string | null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class CreateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<Subscription> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      if (await this.subscriptions.findCurrent()) {
        throw new SubscriptionAlreadyExistsError(input.tenantId);
      }

      const plan = await this.plans.findById(input.planId);
      if (!plan) throw new PlanNotFoundError(input.planId);

      const now = this.clock.now();
      const periodStart = input.currentPeriodStart ?? now;
      const periodEnd =
        input.currentPeriodEnd ??
        addMonths(periodStart, plan.billingPeriodMonths);

      if (!(periodEnd > periodStart)) {
        throw new ValidationError(ErrorCode.SUBSCRIPTION_INVALID_PERIOD);
      }

      const created = await this.subscriptions.create({
        planId: plan.id,
        status: input.status ?? SubscriptionStatus.TRIALING,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        configOverrides:
          input.configOverrides === undefined
            ? null
            : input.configOverrides === null
              ? null
              : parsePartialPlanConfig(input.configOverrides),
        price: plan.price,
        notes: input.notes ?? null,
      });

      await this.audit.record({
        action: AuditAction.SUBSCRIPTION_CREATED,
        entity: 'subscription',
        entityId: created.id,
        tenantId: input.tenantId,
        after: {
          planId: plan.id,
          status: created.status,
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
        },
      });

      return created;
    });
  }
}
