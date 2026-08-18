import {
  LlmFinishReason,
  LlmToolCall,
  LlmToolChoice,
  LlmUsage,
} from '@domain/agent/ports/llm.port';
import { AgentTraceSummary } from '@domain/agent/views/agent-trace-summary';

export type AgentTracePhase = 'initial' | 'claim_retry' | 'schedule_retry';

export type AgentTraceOutcome =
  | 'answered'
  | 'max_rounds'
  | 'handoff_claims'
  | 'handoff_schedule'
  | 'failed'
  | 'skipped_paused'
  | 'skipped_quota'
  | 'skipped_superseded'
  | 'skipped_non_text'
  | 'short_circuit_greeting';

export type TracedToolStatus = 'success' | 'warning' | 'error';

export interface TracedFollowUp {
  kind: string;
  appointmentId?: string;
}

export interface TracedLlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
  truncated?: boolean;
}

export type AgentTraceStep =
  | {
      type: 'llm_request';
      round: number;
      phase: AgentTracePhase;
      toolChoice: LlmToolChoice;
      messages: TracedLlmMessage[];
    }
  | {
      type: 'llm_response';
      round: number;
      phase: AgentTracePhase;
      content: string | null;
      toolCalls: LlmToolCall[];
      latencyMs: number;
      model?: string;
      usage?: LlmUsage;
      finishReason?: LlmFinishReason;
      truncated?: boolean;
    }
  | {
      type: 'tool_call';
      round: number;
      name: string;
      arguments: string;
      status: TracedToolStatus;
      summary: string;
      data?: unknown;
      nextActions?: string[];
      offerableTimes?: string[];
      followUp?: TracedFollowUp;
      latencyMs: number;
      error?: string;
      truncated?: boolean;
    }
  | {
      type: 'guard';
      guard: 'claims' | 'offered_times';
      detected: string[];
      action: 'retry' | 'handoff';
    }
  | {
      type: 'outcome';
      text: string;
      reason: AgentTraceOutcome;
    };

export interface AgentTraceProps {
  id: string;
  tenantId: string;
  conversationId: string;
  triggerProviderMessageId: string;
  inboundText: string | null;
  finalText: string | null;
  promptFingerprint: string | null;
  staticPrompt: string | null;
  volatilePrompt: string | null;
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
  steps: AgentTraceStep[];
  startedAt: Date;
  createdAt?: Date;
}

export class AgentTrace {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly conversationId: string;
  public readonly triggerProviderMessageId: string;
  public readonly inboundText: string | null;
  public readonly finalText: string | null;
  public readonly promptFingerprint: string | null;
  public readonly staticPrompt: string | null;
  public readonly volatilePrompt: string | null;
  public readonly outcome: AgentTraceOutcome;
  public readonly rounds: number;
  public readonly toolCalls: number;
  public readonly errorCount: number;
  public readonly durationMs: number;
  public readonly llmCalls: number;
  public readonly promptTokensTotal: number;
  public readonly completionTokensTotal: number;
  public readonly cachedPromptTokensTotal: number;
  public readonly cacheWriteTokensTotal: number;
  public readonly costCreditsTotal: number | null;
  public readonly steps: AgentTraceStep[];
  public readonly startedAt: Date;
  public readonly createdAt?: Date;

  constructor(props: AgentTraceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.conversationId = props.conversationId;
    this.triggerProviderMessageId = props.triggerProviderMessageId;
    this.inboundText = props.inboundText;
    this.finalText = props.finalText;
    this.promptFingerprint = props.promptFingerprint;
    this.staticPrompt = props.staticPrompt;
    this.volatilePrompt = props.volatilePrompt;
    this.outcome = props.outcome;
    this.rounds = props.rounds;
    this.toolCalls = props.toolCalls;
    this.errorCount = props.errorCount;
    this.durationMs = props.durationMs;
    this.llmCalls = props.llmCalls;
    this.promptTokensTotal = props.promptTokensTotal;
    this.completionTokensTotal = props.completionTokensTotal;
    this.cachedPromptTokensTotal = props.cachedPromptTokensTotal;
    this.cacheWriteTokensTotal = props.cacheWriteTokensTotal;
    this.costCreditsTotal = props.costCreditsTotal;
    this.steps = props.steps;
    this.startedAt = props.startedAt;
    this.createdAt = props.createdAt;
  }

  // Summaries hide the full timeline so the thread list stays light.
  toSummary(): AgentTraceSummary {
    return {
      id: this.id,
      conversationId: this.conversationId,
      triggerProviderMessageId: this.triggerProviderMessageId,
      inboundText: this.inboundText,
      finalText: this.finalText,
      promptFingerprint: this.promptFingerprint,
      outcome: this.outcome,
      rounds: this.rounds,
      toolCalls: this.toolCalls,
      errorCount: this.errorCount,
      durationMs: this.durationMs,
      llmCalls: this.llmCalls,
      promptTokensTotal: this.promptTokensTotal,
      completionTokensTotal: this.completionTokensTotal,
      cachedPromptTokensTotal: this.cachedPromptTokensTotal,
      cacheWriteTokensTotal: this.cacheWriteTokensTotal,
      costCreditsTotal: this.costCreditsTotal,
      startedAt: this.startedAt,
    };
  }
}
