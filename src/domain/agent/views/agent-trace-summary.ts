import { AgentTraceOutcome } from '../entities/agent-trace.entity';

export interface AgentTraceSummary {
  id: string;
  conversationId: string;
  triggerProviderMessageId: string;
  inboundText: string | null;
  finalText: string | null;
  promptFingerprint: string | null;
  outcome: AgentTraceOutcome;
  rounds: number;
  toolCalls: number;
  errorCount: number;
  durationMs: number;
  llmCalls: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  cachedPromptTokensTotal: number;
  cacheWriteTokensTotal: number;
  costCreditsTotal: number | null;
  startedAt: Date;
}
