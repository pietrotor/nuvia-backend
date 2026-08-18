import {
  AgentTrace,
  AgentTraceOutcome,
  AgentTraceStep,
} from '@domain/agent/entities/agent-trace.entity';

import {
  AgentTraceSchema,
  NewAgentTraceSchema,
} from '../schema/agent-trace.schema';

export class AgentTraceMapper {
  static toDomain(row: AgentTraceSchema): AgentTrace {
    return new AgentTrace({
      id: row.id,
      tenantId: row.tenantId,
      conversationId: row.conversationId,
      triggerProviderMessageId: row.triggerProviderMessageId,
      inboundText: row.inboundText,
      finalText: row.finalText,
      promptFingerprint: row.promptFingerprint,
      staticPrompt: row.staticPrompt,
      volatilePrompt: row.volatilePrompt,
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
      steps: (row.steps ?? []) as AgentTraceStep[],
      startedAt: row.startedAt,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(
    trace: AgentTrace,
  ): Omit<NewAgentTraceSchema, 'tenantId' | 'createdAt' | 'updatedAt'> {
    return {
      id: trace.id,
      conversationId: trace.conversationId,
      triggerProviderMessageId: trace.triggerProviderMessageId,
      inboundText: trace.inboundText,
      finalText: trace.finalText,
      promptFingerprint: trace.promptFingerprint,
      staticPrompt: trace.staticPrompt,
      volatilePrompt: trace.volatilePrompt,
      outcome: trace.outcome,
      rounds: trace.rounds,
      toolCalls: trace.toolCalls,
      errorCount: trace.errorCount,
      durationMs: trace.durationMs,
      llmCalls: trace.llmCalls,
      promptTokensTotal: trace.promptTokensTotal,
      completionTokensTotal: trace.completionTokensTotal,
      cachedPromptTokensTotal: trace.cachedPromptTokensTotal,
      cacheWriteTokensTotal: trace.cacheWriteTokensTotal,
      costCreditsTotal:
        trace.costCreditsTotal == null
          ? null
          : trace.costCreditsTotal.toFixed(8),
      steps: trace.steps,
      startedAt: trace.startedAt,
    };
  }
}
