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
  SubscriptionNotFoundError,
} from '@domain/subscriptions/exceptions/subscription.exceptions';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

export interface RenewSubscriptionInput {
  tenantId: string;
  planId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class RenewSubscriptionUseCase {
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

  async execute(input: RenewSubscriptionInput): Promise<Subscription> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const current = await this.subscriptions.findCurrentWithPlan();
      if (!current) throw new SubscriptionNotFoundError(input.tenantId);

      const plan = input.planId
        ? await this.plans.findById(input.planId)
        : (current.plan ?? (await this.plans.findById(current.planId)));
      if (!plan) throw new PlanNotFoundError(input.planId ?? current.planId);

      const now = this.clock.now();
      const periodStart =
        input.periodStart ??
        (now > current.currentPeriodEnd ? now : current.currentPeriodEnd);
      const periodEnd =
        input.periodEnd ?? addMonths(periodStart, plan.billingPeriodMonths);

      if (!(periodEnd > periodStart)) {
        throw new ValidationError(ErrorCode.SUBSCRIPTION_INVALID_PERIOD);
      }

      const updated = await this.subscriptions.update(current.id, {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        price: plan.price,
        cancelledAt: null,
      });

      if (!updated) throw new SubscriptionNotFoundError(input.tenantId);

      await this.audit.record({
        action: AuditAction.SUBSCRIPTION_RENEWED,
        entity: 'subscription',
        entityId: current.id,
        tenantId: input.tenantId,
        before: {
          planId: current.planId,
          currentPeriodStart: current.currentPeriodStart.toISOString(),
          currentPeriodEnd: current.currentPeriodEnd.toISOString(),
          status: current.status,
        },
        after: {
          planId: plan.id,
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          status: SubscriptionStatus.ACTIVE,
        },
      });

      return updated;
    });
  }
}
