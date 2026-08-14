import { Injectable } from '@nestjs/common';
import { and, count, gte, isNotNull, lt } from 'drizzle-orm';

import { AgentUsageViewRepository } from '@domain/subscriptions/repositories/agent-usage.view-repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { messages } from '../drizzle/schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleAgentUsageViewRepository
  extends TenantScopedRepository
  implements AgentUsageViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async countAgentRepliesBetween(range: {
    from: Date;
    to: Date;
  }): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          this.scope(messages),
          isNotNull(messages.promptFingerprint),
          gte(messages.occurredAt, range.from),
          lt(messages.occurredAt, range.to),
        ),
      );

    return Number(row?.value ?? 0);
  }
}
