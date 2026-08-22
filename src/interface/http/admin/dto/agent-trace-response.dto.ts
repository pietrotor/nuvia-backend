import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PruneAgentTracesResult } from '@application/agent/use-cases/prune-agent-traces.use-case';
import {
  AgentTrace,
  AgentTraceOutcome,
  AgentTraceStep,
} from '@domain/agent/entities/agent-trace.entity';
import { AgentEconomicsSummary } from '@domain/agent/views/agent-economics-summary';
import { AgentTraceSummary } from '@domain/agent/views/agent-trace-summary';
import { AgentTracedConversationView } from '@domain/agent/views/agent-traced-conversation-view';
import { Message } from '@domain/conversations/entities/message.entity';
import { ConversationResponseDto } from '@interface/http/conversations/dto/conversation-response.dto';
import { MessageResponseDto } from '@interface/http/conversations/dto/message-response.dto';

export class AgentTracedConversationResponseDto {
  @ApiProperty({ type: ConversationResponseDto })
  conversation: ConversationResponseDto;

  @ApiProperty()
  turns: number;

  @ApiProperty()
  errorTurns: number;

  static from(
    view: AgentTracedConversationView,
  ): AgentTracedConversationResponseDto {
    return {
      conversation: ConversationResponseDto.from(
        view.conversation,
        view.client,
      ),
      turns: view.turns,
      errorTurns: view.errorTurns,
    };
  }
}

export class AgentTraceSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  triggerProviderMessageId: string;

  @ApiPropertyOptional({ nullable: true })
  inboundText: string | null;

  @ApiPropertyOptional({ nullable: true })
  finalText: string | null;

  @ApiPropertyOptional({ nullable: true })
  promptFingerprint: string | null;

  @ApiProperty({
    enum: [
      'answered',
      'max_rounds',
      'handoff_claims',
      'handoff_schedule',
      'failed',
      'skipped_paused',
      'skipped_quota',
      'skipped_superseded',
      'skipped_non_text',
      'short_circuit_greeting',
    ],
  })
  outcome: AgentTraceOutcome;

  @ApiProperty()
  rounds: number;

  @ApiProperty()
  toolCalls: number;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  durationMs: number;

  @ApiProperty()
  llmCalls: number;

  @ApiProperty()
  promptTokensTotal: number;

  @ApiProperty()
  completionTokensTotal: number;

  @ApiProperty()
  cachedPromptTokensTotal: number;

  @ApiProperty()
  cacheWriteTokensTotal: number;

  @ApiPropertyOptional({ nullable: true })
  costCreditsTotal: number | null;

  @ApiProperty()
  startedAt: string;

  static from(summary: AgentTraceSummary): AgentTraceSummaryResponseDto {
    return {
      id: summary.id,
      conversationId: summary.conversationId,
      triggerProviderMessageId: summary.triggerProviderMessageId,
      inboundText: summary.inboundText,
      finalText: summary.finalText,
      promptFingerprint: summary.promptFingerprint,
      outcome: summary.outcome,
      rounds: summary.rounds,
      toolCalls: summary.toolCalls,
      errorCount: summary.errorCount,
      durationMs: summary.durationMs,
      llmCalls: summary.llmCalls,
      promptTokensTotal: summary.promptTokensTotal,
      completionTokensTotal: summary.completionTokensTotal,
      cachedPromptTokensTotal: summary.cachedPromptTokensTotal,
      cacheWriteTokensTotal: summary.cacheWriteTokensTotal,
      costCreditsTotal: summary.costCreditsTotal,
      startedAt: summary.startedAt.toISOString(),
    };
  }
}

export class AgentEconomicsResponseDto {
  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty()
  traces: number;

  @ApiProperty()
  llmCalls: number;

  @ApiProperty()
  promptTokensTotal: number;

  @ApiProperty()
  completionTokensTotal: number;

  @ApiProperty()
  cachedPromptTokensTotal: number;

  @ApiProperty()
  cacheWriteTokensTotal: number;

  @ApiProperty()
  costCreditsTotal: number;

  @ApiProperty()
  bookingTraces: number;

  @ApiPropertyOptional({ nullable: true })
  costCreditsPerBooking: number | null;

  static from(summary: AgentEconomicsSummary): AgentEconomicsResponseDto {
    return {
      from: summary.from.toISOString(),
      to: summary.to.toISOString(),
      traces: summary.traces,
      llmCalls: summary.llmCalls,
      promptTokensTotal: summary.promptTokensTotal,
      completionTokensTotal: summary.completionTokensTotal,
      cachedPromptTokensTotal: summary.cachedPromptTokensTotal,
      cacheWriteTokensTotal: summary.cacheWriteTokensTotal,
      costCreditsTotal: summary.costCreditsTotal,
      bookingTraces: summary.bookingTraces,
      costCreditsPerBooking: summary.costCreditsPerBooking,
    };
  }
}

export class ConversationTraceThreadResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages: MessageResponseDto[];

  @ApiProperty({ type: [AgentTraceSummaryResponseDto] })
  traces: AgentTraceSummaryResponseDto[];

  static from(input: {
    messages: Message[];
    quotedMessagesByProviderId: Map<string, Message>;
    traces: AgentTraceSummary[];
  }): ConversationTraceThreadResponseDto {
    return {
      messages: input.messages.map((message) =>
        MessageResponseDto.from(
          message,
          message.inReplyToProviderMessageId
            ? (input.quotedMessagesByProviderId.get(
                message.inReplyToProviderMessageId,
              ) ?? null)
            : null,
        ),
      ),
      traces: input.traces.map(AgentTraceSummaryResponseDto.from),
    };
  }
}

export class AgentTraceDetailResponseDto extends AgentTraceSummaryResponseDto {
  @ApiPropertyOptional({ nullable: true })
  staticPrompt: string | null;

  @ApiPropertyOptional({ nullable: true })
  volatilePrompt: string | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  steps: AgentTraceStep[];

  static from(trace: AgentTrace): AgentTraceDetailResponseDto {
    return {
      ...AgentTraceSummaryResponseDto.from(trace.toSummary()),
      staticPrompt: trace.staticPrompt,
      volatilePrompt: trace.volatilePrompt,
      steps: trace.steps,
    };
  }
}

export class PruneAgentTracesResponseDto {
  @ApiProperty()
  deleted: number;

  @ApiProperty()
  olderThanDays: number;

  @ApiProperty()
  cutoff: string;

  static from(result: PruneAgentTracesResult): PruneAgentTracesResponseDto {
    return {
      deleted: result.deleted,
      olderThanDays: result.olderThanDays,
      cutoff: result.cutoff,
    };
  }
}
