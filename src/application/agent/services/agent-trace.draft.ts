import { randomUUID } from 'crypto';

import {
  AgentTrace,
  AgentTraceOutcome,
  AgentTracePhase,
  AgentTraceStep,
  TracedFollowUp,
  TracedLlmMessage,
  TracedToolStatus,
} from '@domain/agent/entities/agent-trace.entity';
import {
  LlmFinishReason,
  LlmMessage,
  LlmToolCall,
  LlmToolChoice,
  LlmUsage,
} from '@domain/agent/ports/llm.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';

const DEFAULT_MAX_STEP_CHARS = 8_000;

export interface AgentTraceDraftInput {
  tenantId: string;
  conversationId: string;
  triggerProviderMessageId: string;
  inboundText: string | null;
  startedAt: Date;
  maxStepChars?: number;
}

export class AgentTraceDraft {
  readonly id = randomUUID();
  readonly startedAt: Date;
  private readonly tenantId: string;
  private readonly conversationId: string;
  private readonly triggerProviderMessageId: string;
  private readonly inboundText: string | null;
  private readonly maxStepChars: number;
  private readonly steps: AgentTraceStep[] = [];
  private staticPrompt: string | null = null;
  private volatilePrompt: string | null = null;
  private promptFingerprint: string | null = null;
  private finalText: string | null = null;
  private outcome: AgentTraceOutcome = 'answered';
  private rounds = 0;
  private toolCalls = 0;
  private errorCount = 0;
  private llmCalls = 0;
  private promptTokensTotal = 0;
  private completionTokensTotal = 0;
  private cachedPromptTokensTotal = 0;
  private cacheWriteTokensTotal = 0;
  private costCreditsTotal: number | null = null;

  constructor(input: AgentTraceDraftInput) {
    this.tenantId = input.tenantId;
    this.conversationId = input.conversationId;
    this.triggerProviderMessageId = input.triggerProviderMessageId;
    this.inboundText = input.inboundText;
    this.startedAt = input.startedAt;
    this.maxStepChars = input.maxStepChars ?? DEFAULT_MAX_STEP_CHARS;
  }

  setPendingOutcome(reason: AgentTraceOutcome): void {
    this.outcome = reason;
  }

  setPrompt(input: {
    staticText: string;
    volatileText: string;
    fingerprint: string;
  }): void {
    this.staticPrompt = input.staticText;
    this.volatilePrompt = input.volatileText;
    this.promptFingerprint = input.fingerprint;
  }

  recordLlmRequest(input: {
    round: number;
    phase: AgentTracePhase;
    toolChoice: LlmToolChoice;
    messages: LlmMessage[];
  }): void {
    this.rounds = Math.max(this.rounds, input.round + 1);
    this.steps.push({
      type: 'llm_request',
      round: input.round,
      phase: input.phase,
      toolChoice: input.toolChoice,
      messages: input.messages
        .filter((message) => message.role !== 'system')
        .map((message) => this.traceMessage(message)),
    });
  }

  recordLlmResponse(input: {
    round: number;
    phase: AgentTracePhase;
    content: string | null;
    toolCalls: LlmToolCall[];
    latencyMs: number;
    model?: string;
    usage?: LlmUsage;
    finishReason?: LlmFinishReason;
  }): void {
    this.llmCalls += 1;
    this.addUsage(input.usage);
    const { value, truncated } = this.truncateText(input.content);
    this.steps.push({
      type: 'llm_response',
      round: input.round,
      phase: input.phase,
      content: value,
      toolCalls: input.toolCalls,
      latencyMs: input.latencyMs,
      model: input.model,
      usage: input.usage,
      finishReason: input.finishReason,
      truncated: truncated || undefined,
    });
  }

  recordToolCall(input: {
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
  }): void {
    this.toolCalls += 1;
    if (input.status === 'error') this.errorCount += 1;
    const { value: data, truncated: dataTruncated } = this.truncateJson(
      input.data,
    );
    const { value: args, truncated: argsTruncated } = this.truncateText(
      input.arguments,
    );
    this.steps.push({
      type: 'tool_call',
      round: input.round,
      name: input.name,
      arguments: args ?? '',
      status: input.status,
      summary: input.summary,
      data,
      nextActions: input.nextActions,
      offerableTimes: input.offerableTimes,
      followUp: input.followUp,
      latencyMs: input.latencyMs,
      error: input.error,
      truncated: dataTruncated || argsTruncated || undefined,
    });
  }

  recordGuard(input: {
    guard: 'claims' | 'offered_times';
    detected: string[];
    action: 'retry' | 'handoff';
  }): void {
    this.steps.push({
      type: 'guard',
      guard: input.guard,
      detected: input.detected,
      action: input.action,
    });
  }

  finish(input: {
    text: string;
    reason?: AgentTraceOutcome;
    endedAt: Date;
  }): AgentTrace {
    this.finalText = input.text;
    if (input.reason) this.outcome = input.reason;
    this.steps.push({
      type: 'outcome',
      text: input.text,
      reason: this.outcome,
    });
    return this.toEntity(input.endedAt);
  }

  fail(input: { error: unknown; endedAt: Date }): AgentTrace {
    const message =
      input.error instanceof Error ? input.error.message : String(input.error);
    this.outcome = 'failed';
    this.errorCount += 1;
    this.finalText = message;
    this.recordLlmError(input.error);
    this.steps.push({
      type: 'outcome',
      text: message,
      reason: 'failed',
    });
    return this.toEntity(input.endedAt);
  }

  private recordLlmError(error: unknown): void {
    if (
      !(error instanceof DomainException) ||
      (error.code !== ErrorCode.LLM_PROVIDER_ERROR &&
        error.code !== ErrorCode.LLM_NOT_CONFIGURED)
    ) {
      return;
    }

    const request = [...this.steps]
      .reverse()
      .find((step) => step.type === 'llm_request');
    if (!request || request.type !== 'llm_request') return;

    this.steps.push({
      type: 'llm_error',
      round: request.round,
      phase: request.phase,
      code: error.code,
      provider: this.stringParam(error, 'provider'),
      status: this.numberParam(error, 'status'),
      model: this.stringParam(error, 'model'),
      errorType: this.stringParam(error, 'error_type'),
      cause: this.stringParam(error, 'cause'),
    });
  }

  private stringParam(error: DomainException, key: string): string | undefined {
    const value = error.params[key];
    return typeof value === 'string' ? value : undefined;
  }

  private numberParam(error: DomainException, key: string): number | undefined {
    const value = error.params[key];
    return typeof value === 'number' ? value : undefined;
  }

  static skipped(input: {
    tenantId: string;
    conversationId: string;
    triggerProviderMessageId: string;
    inboundText: string | null;
    reason:
      | 'skipped_paused'
      | 'skipped_quota'
      | 'skipped_superseded'
      | 'skipped_non_text'
      | 'short_circuit_greeting';
    startedAt: Date;
  }): AgentTrace {
    const draft = new AgentTraceDraft(input);
    return draft.finish({
      text: '',
      reason: input.reason,
      endedAt: input.startedAt,
    });
  }

  private addUsage(usage: LlmUsage | undefined): void {
    if (!usage) return;
    this.promptTokensTotal += usage.promptTokens;
    this.completionTokensTotal += usage.completionTokens;
    this.cachedPromptTokensTotal += usage.cachedPromptTokens ?? 0;
    this.cacheWriteTokensTotal += usage.cacheWriteTokens ?? 0;
    if (usage.costCredits != null) {
      this.costCreditsTotal = (this.costCreditsTotal ?? 0) + usage.costCredits;
    }
  }

  private toEntity(endedAt: Date): AgentTrace {
    return new AgentTrace({
      id: this.id,
      tenantId: this.tenantId,
      conversationId: this.conversationId,
      triggerProviderMessageId: this.triggerProviderMessageId,
      inboundText: this.inboundText,
      finalText: this.finalText,
      promptFingerprint: this.promptFingerprint,
      staticPrompt: this.staticPrompt,
      volatilePrompt: this.volatilePrompt,
      outcome: this.outcome,
      rounds: this.rounds,
      toolCalls: this.toolCalls,
      errorCount: this.errorCount,
      durationMs: Math.max(0, endedAt.getTime() - this.startedAt.getTime()),
      llmCalls: this.llmCalls,
      promptTokensTotal: this.promptTokensTotal,
      completionTokensTotal: this.completionTokensTotal,
      cachedPromptTokensTotal: this.cachedPromptTokensTotal,
      cacheWriteTokensTotal: this.cacheWriteTokensTotal,
      costCreditsTotal: this.costCreditsTotal,
      steps: [...this.steps],
      startedAt: this.startedAt,
    });
  }

  private traceMessage(message: LlmMessage): TracedLlmMessage {
    const { value, truncated } = this.truncateText(message.content);
    return {
      role: message.role,
      content: value ?? '',
      name: message.name,
      toolCallId: message.toolCallId,
      toolCalls: message.toolCalls,
      truncated: truncated || undefined,
    };
  }

  private truncateText(value: string | null | undefined): {
    value: string | null;
    truncated: boolean;
  } {
    if (value == null) return { value: null, truncated: false };
    if (value.length <= this.maxStepChars) {
      return { value, truncated: false };
    }
    return {
      value: `${value.slice(0, this.maxStepChars)}…`,
      truncated: true,
    };
  }

  private truncateJson(value: unknown): { value: unknown; truncated: boolean } {
    if (value === undefined) return { value: undefined, truncated: false };
    const serialized = JSON.stringify(value);
    if (serialized == null) return { value, truncated: false };
    if (serialized.length <= this.maxStepChars) {
      return { value, truncated: false };
    }
    return {
      value: `${serialized.slice(0, this.maxStepChars)}…`,
      truncated: true,
    };
  }
}
