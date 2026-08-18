import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
  sum,
} from 'drizzle-orm';

import { AgentTraceOutcome } from '@domain/agent/entities/agent-trace.entity';
import { AgentTraceViewRepository } from '@domain/agent/repositories/agent-trace-view.repository';
import { AgentEconomicsSummary } from '@domain/agent/views/agent-economics-summary';
import { AgentTraceSummary } from '@domain/agent/views/agent-trace-summary';
import { AgentTracedConversationListResult } from '@domain/agent/views/agent-traced-conversation-view';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { ConversationMapper } from '../drizzle/mappers/conversation.mapper';
import { agentTraces } from '../drizzle/schema/agent-trace.schema';
import { clients } from '../drizzle/schema/client.schema';
import { conversations } from '../drizzle/schema/conversation.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

const ERROR_OUTCOMES: AgentTraceOutcome[] = [
  'failed',
  'handoff_claims',
  'handoff_schedule',
  'max_rounds',
];

@Injectable()
export class DrizzleAgentTraceViewRepository
  extends TenantScopedRepository
  implements AgentTraceViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async listConversations(input: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<AgentTracedConversationListResult> {
    const search = input.search?.trim();
    const searchCondition = search
      ? or(
          ilike(clients.name, `%${search}%`),
          ilike(conversations.clientPhoneE164, `%${search}%`),
        )
      : undefined;

    const where = and(
      this.scope(conversations),
      sql`exists (
        select 1 from ${agentTraces}
        where ${agentTraces.conversationId} = ${conversations.id}
          and ${agentTraces.tenantId} = ${conversations.tenantId}
      )`,
      searchCondition,
    );

    const [countRow] = await this.drizzle.db
      .select({ total: count() })
      .from(conversations)
      .leftJoin(
        clients,
        and(
          eq(clients.id, conversations.clientId),
          eq(clients.tenantId, conversations.tenantId),
        ),
      )
      .where(where);

    const rows = await this.drizzle.db
      .select({
        conversation: conversations,
        client: {
          id: clients.id,
          name: clients.name,
          phoneE164: clients.phoneE164,
        },
        turns: sql<number>`(
          select count(*)::int from ${agentTraces}
          where ${agentTraces.conversationId} = ${conversations.id}
            and ${agentTraces.tenantId} = ${conversations.tenantId}
        )`,
        errorTurns: sql<number>`(
          select count(*)::int from ${agentTraces}
          where ${agentTraces.conversationId} = ${conversations.id}
            and ${agentTraces.tenantId} = ${conversations.tenantId}
            and ${agentTraces.outcome} in (${sql.join(
              ERROR_OUTCOMES.map((outcome) => sql`${outcome}`),
              sql`, `,
            )})
        )`,
      })
      .from(conversations)
      .leftJoin(
        clients,
        and(
          eq(clients.id, conversations.clientId),
          eq(clients.tenantId, conversations.tenantId),
        ),
      )
      .where(where)
      .orderBy(desc(conversations.lastActivityAt))
      .limit(input.limit)
      .offset(input.offset);

    return {
      total: Number(countRow?.total ?? 0),
      rows: rows.map((row) => ({
        conversation: ConversationMapper.toDomain(row.conversation),
        client: row.client?.id ? row.client : null,
        turns: Number(row.turns ?? 0),
        errorTurns: Number(row.errorTurns ?? 0),
      })),
    };
  }

  async listByConversation(
    conversationId: string,
  ): Promise<AgentTraceSummary[]> {
    const rows = await this.drizzle.db
      .select({
        id: agentTraces.id,
        conversationId: agentTraces.conversationId,
        triggerProviderMessageId: agentTraces.triggerProviderMessageId,
        inboundText: agentTraces.inboundText,
        finalText: agentTraces.finalText,
        promptFingerprint: agentTraces.promptFingerprint,
        outcome: agentTraces.outcome,
        rounds: agentTraces.rounds,
        toolCalls: agentTraces.toolCalls,
        errorCount: agentTraces.errorCount,
        durationMs: agentTraces.durationMs,
        llmCalls: agentTraces.llmCalls,
        promptTokensTotal: agentTraces.promptTokensTotal,
        completionTokensTotal: agentTraces.completionTokensTotal,
        cachedPromptTokensTotal: agentTraces.cachedPromptTokensTotal,
        cacheWriteTokensTotal: agentTraces.cacheWriteTokensTotal,
        costCreditsTotal: agentTraces.costCreditsTotal,
        startedAt: agentTraces.startedAt,
      })
      .from(agentTraces)
      .where(
        this.scope(agentTraces, eq(agentTraces.conversationId, conversationId)),
      )
      .orderBy(desc(agentTraces.startedAt));

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      triggerProviderMessageId: row.triggerProviderMessageId,
      inboundText: row.inboundText,
      finalText: row.finalText,
      promptFingerprint: row.promptFingerprint,
      outcome: row.outcome as AgentTraceOutcome,
      rounds: row.rounds,
      toolCalls: row.toolCalls,
      errorCount: row.errorCount,
      durationMs: row.durationMs,
      llmCalls: row.llmCalls,
      promptTokensTotal: row.promptTokensTotal,
      completionTokensTotal: row.completionTokensTotal,
      cachedPromptTokensTotal: row.cachedPromptTokensTotal,
      cacheWriteTokensTotal: row.cacheWriteTokensTotal,
      costCreditsTotal:
        row.costCreditsTotal == null ? null : Number(row.costCreditsTotal),
      startedAt: row.startedAt,
    }));
  }

  async summarizeEconomics(range: {
    from: Date;
    to: Date;
  }): Promise<AgentEconomicsSummary> {
    const [totals] = await this.drizzle.db
      .select({
        traces: count(),
        llmCalls: sum(agentTraces.llmCalls),
        promptTokensTotal: sum(agentTraces.promptTokensTotal),
        completionTokensTotal: sum(agentTraces.completionTokensTotal),
        cachedPromptTokensTotal: sum(agentTraces.cachedPromptTokensTotal),
        cacheWriteTokensTotal: sum(agentTraces.cacheWriteTokensTotal),
        costCreditsTotal: sum(agentTraces.costCreditsTotal),
      })
      .from(agentTraces)
      .where(
        and(
          this.scope(agentTraces),
          gte(agentTraces.startedAt, range.from),
          lt(agentTraces.startedAt, range.to),
        ),
      );

    const [bookings] = await this.drizzle.db
      .select({
        bookingTraces: count(),
        costCreditsTotal: sum(agentTraces.costCreditsTotal),
      })
      .from(agentTraces)
      .where(
        and(
          this.scope(agentTraces),
          gte(agentTraces.startedAt, range.from),
          lt(agentTraces.startedAt, range.to),
          sql`exists (
            select 1
            from jsonb_array_elements(${agentTraces.steps}) as step
            where step->>'type' = 'tool_call'
              and step->>'name' = 'book_appointment'
              and step->>'status' = 'success'
          )`,
        ),
      );

    const bookingTraces = Number(bookings?.bookingTraces ?? 0);
    const bookingCost = Number(bookings?.costCreditsTotal ?? 0);

    return {
      from: range.from,
      to: range.to,
      traces: Number(totals?.traces ?? 0),
      llmCalls: Number(totals?.llmCalls ?? 0),
      promptTokensTotal: Number(totals?.promptTokensTotal ?? 0),
      completionTokensTotal: Number(totals?.completionTokensTotal ?? 0),
      cachedPromptTokensTotal: Number(totals?.cachedPromptTokensTotal ?? 0),
      cacheWriteTokensTotal: Number(totals?.cacheWriteTokensTotal ?? 0),
      costCreditsTotal: Number(totals?.costCreditsTotal ?? 0),
      bookingTraces,
      costCreditsPerBooking:
        bookingTraces > 0 ? bookingCost / bookingTraces : null,
    };
  }
}
