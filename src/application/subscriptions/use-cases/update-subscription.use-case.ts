import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { Subscription } from '@domain/subscriptions/entities/subscription.entity';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import { SubscriptionNotFoundError } from '@domain/subscriptions/exceptions/subscription.exceptions';
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

export interface UpdateSubscriptionInput {
  tenantId: string;
  status?: SubscriptionStatus;
  configOverrides?: PartialPlanConfig | null;
  notes?: string | null;
}

@Injectable()
export class UpdateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: UpdateSubscriptionInput): Promise<Subscription> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const current = await this.subscriptions.findCurrent();
      if (!current) throw new SubscriptionNotFoundError(input.tenantId);

      const configOverrides =
        input.configOverrides === undefined
          ? undefined
          : input.configOverrides === null
            ? null
            : parsePartialPlanConfig(input.configOverrides);

      const cancelledAt =
        input.status === SubscriptionStatus.CANCELLED
          ? this.clock.now()
          : input.status !== undefined
            ? null
            : undefined;

      const updated = await this.subscriptions.update(current.id, {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(configOverrides !== undefined ? { configOverrides } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(cancelledAt !== undefined ? { cancelledAt } : {}),
      });
      if (!updated) throw new SubscriptionNotFoundError(input.tenantId);

      await this.audit.record({
        action: AuditAction.SUBSCRIPTION_STATUS_CHANGED,
        entity: 'subscription',
        entityId: current.id,
        tenantId: input.tenantId,
        before: {
          status: current.status,
          configOverrides: current.configOverrides,
        },
        after: {
          status: updated.status,
          configOverrides: updated.configOverrides,
        },
      });

      return updated;
    });
  }
}
