import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { DEFAULT_AGENT_POLICY } from '@domain/business-config/entities/business-config.entity';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';
import { shouldAutoResumeHandoff } from '@domain/conversations/services/should-auto-resume-handoff';
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import {
  circadianSlowdown,
  humanTypingDelayMs,
} from '@domain/messaging/services/human-pacing';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { SendDepositQrUseCase } from '@application/deposits/use-cases/send-deposit-qr.use-case';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  AGENT_TRACE_REPOSITORY,
  AgentTraceRepository,
} from '@domain/agent/repositories/agent-trace.repository';
import { ConversationHandoffLabelService } from '@application/conversations/services/conversation-handoff-label.service';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { greetingReply, isPureGreeting } from '../messages/pure-greeting';
import { toWhatsAppText } from '../messages/whatsapp-text';
import { AgentOrchestrator } from '../services/agent-orchestrator.service';
import { AgentTraceDraft } from '../services/agent-trace.draft';
import { AgentFollowUp } from '../tools/agent-tool';

const HISTORY_SIZE = 20;

const FALLBACK_TIMEZONE = 'America/La_Paz';

// WhatsApp drops the indicator on its own after a few seconds, and the send
// itself brings a fresh one, so this only has to cover the agent thinking.
const THINKING_INDICATOR_MS = 5_000;

const SUBSCRIPTION_HANDOFF_REASON = 'subscription_limit';

const LLM_HANDOFF_REASON = 'llm_provider_error';

export interface ReplyToConversationInput {
  tenantId: string;
  conversationId: string;
  clientId: string;
  clientPhoneE164: string;
  providerMessageId: string;
}

@Injectable()
export class ReplyToConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
    private readonly orchestrator: AgentOrchestrator,
    private readonly sendDepositQr: SendDepositQrUseCase,
    private readonly audit: AuditRecorder,
    private readonly entitlements: PlanEntitlements,
    @Inject(AGENT_TRACE_REPOSITORY)
    private readonly traces: AgentTraceRepository,
    private readonly configService: ConfigService,
    private readonly handoffLabel: ConversationHandoffLabelService,
  ) {}

  async execute(input: ReplyToConversationInput): Promise<void> {
    if (await this.messages.hasReplyTo(input.providerMessageId)) return;

    const conversation = await this.conversations.findById(
      input.conversationId,
    );
    if (!conversation) return;

    let history = await this.messages.findRecent(conversation.id, HISTORY_SIZE);
    const trigger = this.lastInbound(history);
    // The client kept writing after this message: the job queued for her last
    // one answers the whole burst, so this job steps aside.
    if (!trigger || trigger.providerMessageId !== input.providerMessageId) {
      await this.recordSkip(
        input,
        trigger?.content ?? null,
        'skipped_superseded',
      );
      return;
    }

    const config = await this.businessConfigs.findByTenant();
    const agentName = config?.agentName ?? 'Vale';
    const handoffAutoResumeMinutes =
      config?.agentPolicy.handoffAutoResumeMinutes ??
      DEFAULT_AGENT_POLICY.handoffAutoResumeMinutes;

    if (
      conversation.botPaused &&
      !shouldAutoResumeHandoff({
        botPaused: conversation.botPaused,
        botPausedAt: conversation.botPausedAt,
        now: this.clock.now(),
        handoffAutoResumeMinutes,
      })
    ) {
      await this.recordSkip(input, trigger.content, 'skipped_paused');
      return;
    }

    const access = await this.entitlements.agentAccess();
    if (!access.allowed) {
      const paused = await this.conversations.setHandoff(
        conversation.id,
        SUBSCRIPTION_HANDOFF_REASON,
      );
      await this.handoffLabel.markAttention(paused);
      await this.audit.record({
        action: AuditAction.AGENT_PAUSED_BY_QUOTA,
        entity: 'conversation',
        entityId: conversation.id,
        after: {
          reason: access.reason,
          used: access.used,
          limit: access.limit,
        },
      });
      await this.recordSkip(input, trigger.content, 'skipped_quota');
      return;
    }

    const slowdown = await this.circadianSlowdown(input.tenantId);
    let waitingSince = this.clock.now();
    await this.showReading(input);

    if (conversation.botPaused) {
      const resumed = await this.conversations.resumeBot(conversation.id);
      await this.handoffLabel.clearAttention(resumed);
      await this.audit.record({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        entity: 'conversation',
        entityId: conversation.id,
        after: { reason: 'auto_timeout', source: 'auto_timeout' },
      });

      await this.send({
        conversationId: conversation.id,
        input,
        text: AgentOutboundCopy.handoffAutoResumeBridge(agentName),
        waitingSince,
        slowdown,
        // Only one message may claim to answer the inbound one, and that is the
        // answer below: it is what tells a retried job to stand down.
        inReplyTo: null,
      });
      // The bridge is part of what the agent said, and the wait for the real
      // answer starts once the client has read it.
      history = await this.messages.findRecent(conversation.id, HISTORY_SIZE);
      waitingSince = this.clock.now();
    }

    let answer: {
      text: string;
      promptFingerprint: string | null;
      followUps: AgentFollowUp[];
    };
    try {
      if (
        trigger.kind === MessageKind.TEXT &&
        trigger.content &&
        this.shouldShortCircuitGreeting(trigger.content, history)
      ) {
        answer = await this.greetingAnswer(input, trigger.content, agentName);
      } else if (
        (trigger.kind === MessageKind.TEXT && trigger.content) ||
        this.imageHasTextContext(trigger, history)
      ) {
        answer = await this.orchestrator.respond(
          history,
          {
            tenantId: input.tenantId,
            conversationId: conversation.id,
            clientId: input.clientId,
            clientPhoneE164: input.clientPhoneE164,
          },
          {
            providerMessageId: input.providerMessageId,
            text: trigger.content,
          },
        );
      } else {
        answer = await this.nonTextAnswer(input, trigger.content);
      }
    } catch (error) {
      if (!this.isLlmFailure(error)) throw error;
      await this.handleLlmFailure({
        conversationId: conversation.id,
        input,
        error,
        waitingSince,
        slowdown,
      });
      return;
    }

    await this.send({
      conversationId: conversation.id,
      input,
      text: answer.text,
      promptFingerprint: answer.promptFingerprint,
      waitingSince,
      slowdown,
      inReplyTo: input.providerMessageId,
    });

    for (const followUp of answer.followUps) {
      await this.sendFollowUp(followUp, {
        conversationId: conversation.id,
        clientPhoneE164: input.clientPhoneE164,
      });
    }
  }

  private greetingShortCircuitEnabled(): boolean {
    const raw = this.configService
      .get<string>('LLM_SHORT_CIRCUIT_GREETINGS', 'true')
      ?.trim();
    return raw !== 'false' && raw !== '0';
  }

  private shouldShortCircuitGreeting(
    text: string,
    history: Message[],
  ): boolean {
    if (!this.greetingShortCircuitEnabled()) return false;
    if (!isPureGreeting(text)) return false;
    // Only the opening of a conversation: any earlier inbound that was not a
    // pure greeting means the client already started a real request.
    return history
      .filter(
        (message) =>
          message.direction === MessageDirection.INBOUND &&
          message.kind === MessageKind.TEXT &&
          message.content,
      )
      .every((message) => isPureGreeting(message.content));
  }

  private async greetingAnswer(
    input: ReplyToConversationInput,
    inboundText: string,
    agentName: string,
  ): Promise<{
    text: string;
    promptFingerprint: null;
    followUps: AgentFollowUp[];
  }> {
    await this.recordSkip(input, inboundText, 'short_circuit_greeting');
    return {
      text: greetingReply(agentName),
      promptFingerprint: null,
      followUps: [],
    };
  }

  private isLlmFailure(error: unknown): error is DomainException {
    return (
      error instanceof DomainException &&
      (error.code === ErrorCode.LLM_NOT_CONFIGURED ||
        error.code === ErrorCode.LLM_PROVIDER_ERROR)
    );
  }

  private async handleLlmFailure(params: {
    conversationId: string;
    input: ReplyToConversationInput;
    error: DomainException;
    waitingSince: Date;
    slowdown: number;
  }): Promise<void> {
    this.logger.error(
      `LLM unavailable for conversation ${params.conversationId}: ${params.error.code}` +
        (params.error.params.status != null
          ? ` status=${params.error.params.status}`
          : '') +
        (params.error.params.error_type != null
          ? ` error_type=${params.error.params.error_type}`
          : '') +
        (params.error.params.model != null
          ? ` model=${params.error.params.model}`
          : ''),
      undefined,
      ReplyToConversationUseCase.name,
    );

    const paused = await this.conversations.setHandoff(
      params.conversationId,
      LLM_HANDOFF_REASON,
    );
    await this.handoffLabel.markAttention(paused);
    await this.audit.record({
      action: AuditAction.CONVERSATION_BOT_PAUSED,
      entity: 'conversation',
      entityId: params.conversationId,
      after: { reason: LLM_HANDOFF_REASON, code: params.error.code },
    });

    await this.send({
      conversationId: params.conversationId,
      input: params.input,
      text: AgentOutboundCopy.llmUnavailable,
      waitingSince: params.waitingSince,
      slowdown: params.slowdown,
      inReplyTo: params.input.providerMessageId,
    });
  }

  private async nonTextAnswer(
    input: ReplyToConversationInput,
    inboundText: string | null,
  ): Promise<{
    text: string;
    promptFingerprint: null;
    followUps: AgentFollowUp[];
  }> {
    await this.recordSkip(input, inboundText, 'skipped_non_text');
    return {
      text: AgentOutboundCopy.nonTextInbound,
      promptFingerprint: null,
      followUps: [],
    };
  }

  private async recordSkip(
    input: ReplyToConversationInput,
    inboundText: string | null,
    reason:
      | 'skipped_paused'
      | 'skipped_quota'
      | 'skipped_superseded'
      | 'skipped_non_text'
      | 'short_circuit_greeting',
  ): Promise<void> {
    try {
      await this.traces.save(
        AgentTraceDraft.skipped({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          triggerProviderMessageId: input.providerMessageId,
          inboundText,
          reason,
          startedAt: this.clock.now(),
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not persist skipped agent trace for conversation ${input.conversationId}`,
        error instanceof Error ? error.stack : undefined,
        ReplyToConversationUseCase.name,
      );
    }
  }

  private async send(params: {
    conversationId: string;
    input: ReplyToConversationInput;
    text: string;
    promptFingerprint?: string | null;
    waitingSince: Date;
    slowdown: number;
    inReplyTo: string | null;
  }): Promise<void> {
    const text = toWhatsAppText(params.text);
    const sent = await this.messaging.sendText({
      tenantId: params.input.tenantId,
      toE164: params.input.clientPhoneE164,
      text,
      typingDelayMs: humanTypingDelayMs({
        text,
        elapsedMs: this.clock.now().getTime() - params.waitingSince.getTime(),
        slowdown: params.slowdown,
      }),
      outboundClass: OutboundClass.AGENT_REPLY,
    });
    await this.messages.recordIfNew({
      conversationId: params.conversationId,
      providerMessageId: sent.providerMessageId,
      inReplyToProviderMessageId: params.inReplyTo,
      direction: MessageDirection.OUTBOUND,
      kind: MessageKind.TEXT,
      content: text,
      promptFingerprint: params.promptFingerprint ?? null,
      occurredAt: this.clock.now(),
    });
  }

  private async circadianSlowdown(tenantId: string): Promise<number> {
    const tenant = await this.tenants.findById(tenantId);
    return circadianSlowdown({
      now: this.clock.now(),
      timezone: tenant?.timezone ?? FALLBACK_TIMEZONE,
    });
  }

  // The read receipt and the indicator are pacing, not delivery: when the
  // provider refuses them the answer still has to go out.
  private async showReading(input: ReplyToConversationInput): Promise<void> {
    try {
      await this.messaging.markAsRead({
        tenantId: input.tenantId,
        toE164: input.clientPhoneE164,
        providerMessageId: input.providerMessageId,
      });
    } catch (error) {
      this.warn('read receipt', error);
    }

    // Awaiting would defeat the purpose: the indicator has to be on screen
    // while the agent thinks, not once it already answered.
    void this.messaging
      .showTyping({
        tenantId: input.tenantId,
        toE164: input.clientPhoneE164,
        durationMs: THINKING_INDICATOR_MS,
      })
      .catch((error: unknown) => this.warn('typing indicator', error));
  }

  private lastInbound(history: Message[]): Message | undefined {
    return history
      .filter((message) => message.direction === MessageDirection.INBOUND)
      .at(-1);
  }

  private imageHasTextContext(trigger: Message, history: Message[]): boolean {
    if (trigger.kind !== MessageKind.IMAGE) return false;
    if (trigger.content?.trim()) return true;

    const triggerIndex = history.findIndex(
      (message) => message.id === trigger.id,
    );
    for (let index = triggerIndex - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (message.direction === MessageDirection.OUTBOUND) return false;
      if (
        message.direction === MessageDirection.INBOUND &&
        message.kind === MessageKind.TEXT &&
        message.content?.trim()
      ) {
        return true;
      }
    }
    return false;
  }

  // A failed follow-up must not fail the job: the reply already went out and is
  // recorded, so a retry would find the inbound answered and skip everything. The
  // client is left waiting for a QR, which is the owner's cue to send it by hand.
  private async sendFollowUp(
    followUp: AgentFollowUp,
    target: { conversationId: string; clientPhoneE164: string },
  ): Promise<void> {
    try {
      await this.sendDepositQr.execute({
        appointmentId: followUp.appointmentId,
        conversationId: target.conversationId,
        clientPhoneE164: target.clientPhoneE164,
      });
    } catch (error) {
      this.logger.error(
        `Could not send the ${followUp.kind} follow-up for appointment ${followUp.appointmentId}`,
        error instanceof Error ? error.stack : undefined,
        ReplyToConversationUseCase.name,
      );
    }
  }

  private warn(what: string, error: unknown): void {
    this.logger.warn(
      `Could not send the ${what}: ${error instanceof Error ? error.message : String(error)}`,
      ReplyToConversationUseCase.name,
    );
  }
}
