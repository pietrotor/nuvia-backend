import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { AgentTraceStep } from '@domain/agent/entities/agent-trace.entity';
import { tenants } from './tenant.schema';
import { conversations } from './conversation.schema';

export const agentTraceOutcomeEnum = pgEnum('agent_trace_outcome', [
  'answered',
  'max_rounds',
  'handoff_claims',
  'handoff_schedule',
  'handoff_incomplete',
  'failed',
  'skipped_paused',
  'skipped_quota',
  'skipped_superseded',
  'skipped_non_text',
  'short_circuit_greeting',
]);

export const agentTraces = pgTable(
  'agent_traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    triggerProviderMessageId: varchar('trigger_provider_message_id', {
      length: 255,
    }).notNull(),
    inboundText: text('inbound_text'),
    finalText: text('final_text'),
    promptFingerprint: varchar('prompt_fingerprint', { length: 64 }),
    staticPrompt: text('static_prompt'),
    volatilePrompt: text('volatile_prompt'),
    outcome: agentTraceOutcomeEnum('outcome').notNull(),
    rounds: integer('rounds').notNull().default(0),
    toolCalls: integer('tool_calls').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    llmCalls: integer('llm_calls').notNull().default(0),
    promptTokensTotal: integer('prompt_tokens_total').notNull().default(0),
    completionTokensTotal: integer('completion_tokens_total')
      .notNull()
      .default(0),
    cachedPromptTokensTotal: integer('cached_prompt_tokens_total')
      .notNull()
      .default(0),
    cacheWriteTokensTotal: integer('cache_write_tokens_total')
      .notNull()
      .default(0),
    costCreditsTotal: numeric('cost_credits_total', {
      precision: 16,
      scale: 8,
    }),
    steps: jsonb('steps').$type<AgentTraceStep[]>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('agent_traces_tenant_idx').on(t.tenantId),
    index('agent_traces_tenant_started_idx').on(t.tenantId, t.startedAt),
    index('agent_traces_conversation_started_idx').on(
      t.conversationId,
      t.startedAt,
    ),
    index('agent_traces_tenant_outcome_idx').on(t.tenantId, t.outcome),
    uniqueIndex('agent_traces_tenant_trigger_uq').on(
      t.tenantId,
      t.triggerProviderMessageId,
    ),
  ],
);

export type AgentTraceSchema = typeof agentTraces.$inferSelect;
export type NewAgentTraceSchema = typeof agentTraces.$inferInsert;
