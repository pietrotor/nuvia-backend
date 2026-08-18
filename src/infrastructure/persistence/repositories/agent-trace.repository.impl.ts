import { Injectable } from '@nestjs/common';
import { count, eq, lt } from 'drizzle-orm';

import { AgentTrace } from '@domain/agent/entities/agent-trace.entity';
import { AgentTraceRepository } from '@domain/agent/repositories/agent-trace.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { AgentTraceMapper } from '../drizzle/mappers/agent-trace.mapper';
import { agentTraces } from '../drizzle/schema/agent-trace.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleAgentTraceRepository
  extends TenantScopedRepository
  implements AgentTraceRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async save(trace: AgentTrace): Promise<AgentTrace> {
    const values = AgentTraceMapper.toPersistence(trace);
    const [row] = await this.drizzle.db
      .insert(agentTraces)
      .values({ ...values, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: [agentTraces.tenantId, agentTraces.triggerProviderMessageId],
        set: {
          conversationId: values.conversationId,
          inboundText: values.inboundText,
          finalText: values.finalText,
          promptFingerprint: values.promptFingerprint,
          staticPrompt: values.staticPrompt,
          volatilePrompt: values.volatilePrompt,
          outcome: values.outcome,
          rounds: values.rounds,
          toolCalls: values.toolCalls,
          errorCount: values.errorCount,
          durationMs: values.durationMs,
          steps: values.steps,
          startedAt: values.startedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    return AgentTraceMapper.toDomain(row);
  }

  async findById(id: string): Promise<AgentTrace | null> {
    const [row] = await this.selectFrom(agentTraces, eq(agentTraces.id, id));
    return row ? AgentTraceMapper.toDomain(row) : null;
  }

  async pruneOlderThan(cutoff: Date): Promise<number> {
    const [countRow] = await this.drizzle.db
      .select({ value: count() })
      .from(agentTraces)
      .where(this.scope(agentTraces, lt(agentTraces.startedAt, cutoff)));
    const deleted = Number(countRow?.value ?? 0);
    if (deleted === 0) return 0;
    await this.deleteFrom(agentTraces, lt(agentTraces.startedAt, cutoff));
    return deleted;
  }
}
