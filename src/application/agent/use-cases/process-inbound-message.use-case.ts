import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { DEFAULT_AGENT_POLICY } from '@domain/business-config/entities/business-config.entity';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
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
} from '@domain/messaging/ports/messaging.port';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { toWhatsAppText } from '../messages/whatsapp-text';
import { AgentOrchestrator } from '../services/agent-orchestrator.service';

export interface ProcessInboundMessageInput {
  tenantId: string;
  providerMessageId: string;
  clientPhoneE164: string;
  clientName: string;
  kind: MessageKind;
  content: string | null;
  occurredAt: Date;
}

@Injectable()
export class ProcessInboundMessageUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clients: ClientRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly orchestrator: AgentOrchestrator,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: ProcessInboundMessageInput): Promise<void> {
    const client = await this.clients.findOrCreate({
      name: input.clientName,
      phoneE164: input.clientPhoneE164,
    });
    const conversation = await this.conversations.findOrCreate({
      clientId: client.id,
      clientPhoneE164: input.clientPhoneE164,
      occurredAt: input.occurredAt,
    });
    const inbound = await this.messages.recordIfNew({
      conversationId: conversation.id,
      providerMessageId: input.providerMessageId,
      direction: MessageDirection.INBOUND,
      kind: input.kind,
      content: input.content,
      occurredAt: input.occurredAt,
    });
    if (!inbound && (await this.messages.hasReplyTo(input.providerMessageId))) {
      return;
    }

    const config = await this.businessConfigs.findByTenant();
    const agentName = config?.agentName ?? 'Vale';
    const handoffAutoResumeMinutes =
      config?.agentPolicy.handoffAutoResumeMinutes ??
      DEFAULT_AGENT_POLICY.handoffAutoResumeMinutes;

    if (conversation.botPaused) {
      if (
        !shouldAutoResumeHandoff({
          botPaused: conversation.botPaused,
          botPausedAt: conversation.botPausedAt,
          now: this.clock.now(),
          handoffAutoResumeMinutes,
        })
      ) {
        return;
      }

      await this.conversations.resumeBot(conversation.id);
      await this.audit.record({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        entity: 'conversation',
        entityId: conversation.id,
        after: { reason: 'auto_timeout' },
      });

      const bridge = toWhatsAppText(
        AgentOutboundCopy.handoffAutoResumeBridge(agentName),
      );
      const bridgeSent = await this.messaging.sendText({
        tenantId: input.tenantId,
        toE164: input.clientPhoneE164,
        text: bridge,
      });
      await this.messages.recordIfNew({
        conversationId: conversation.id,
        providerMessageId: bridgeSent.providerMessageId,
        inReplyToProviderMessageId: input.providerMessageId,
        direction: MessageDirection.OUTBOUND,
        kind: MessageKind.TEXT,
        content: bridge,
        occurredAt: this.clock.now(),
      });
    }

    const answer =
      input.kind === MessageKind.TEXT && input.content
        ? await this.orchestrator.respond(
            await this.messages.findRecent(conversation.id, 20),
            {
              tenantId: input.tenantId,
              conversationId: conversation.id,
              clientId: client.id,
              clientPhoneE164: input.clientPhoneE164,
            },
          )
        : { text: AgentOutboundCopy.nonTextInbound, promptFingerprint: null };
    const response = toWhatsAppText(answer.text);

    const sent = await this.messaging.sendText({
      tenantId: input.tenantId,
      toE164: input.clientPhoneE164,
      text: response,
    });
    await this.messages.recordIfNew({
      conversationId: conversation.id,
      providerMessageId: sent.providerMessageId,
      inReplyToProviderMessageId: input.providerMessageId,
      direction: MessageDirection.OUTBOUND,
      kind: MessageKind.TEXT,
      content: response,
      promptFingerprint: answer.promptFingerprint,
      occurredAt: this.clock.now(),
    });
  }
}
