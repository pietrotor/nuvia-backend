import { Inject, Injectable } from '@nestjs/common';

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
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

export interface ChangeSubscriptionPlanInput {
  tenantId: string;
  planId: string;
}

@Injectable()
export class ChangeSubscriptionPlanUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: ChangeSubscriptionPlanInput): Promise<Subscription> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const current = await this.subscriptions.findCurrent();
      if (!current) throw new SubscriptionNotFoundError(input.tenantId);

      const plan = await this.plans.findById(input.planId);
      if (!plan) throw new PlanNotFoundError(input.planId);

      const updated = await this.subscriptions.update(current.id, {
        planId: plan.id,
        price: plan.price,
      });
      if (!updated) throw new SubscriptionNotFoundError(input.tenantId);

      await this.audit.record({
        action: AuditAction.SUBSCRIPTION_PLAN_CHANGED,
        entity: 'subscription',
        entityId: current.id,
        tenantId: input.tenantId,
        before: { planId: current.planId },
        after: { planId: plan.id },
      });

      return updated;
    });
  }
}
