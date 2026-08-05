import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { ConversationNotFoundError } from '@domain/conversations/exceptions/conversation.exceptions';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';
import {
  MESSAGING_PORT,
  MessagingPort,
} from '@domain/messaging/ports/messaging.port';
import { SendManualMessageDto } from '../dto/send-manual-message.dto';

@Injectable()
export class SendManualMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    conversationId: string,
    dto: SendManualMessageDto,
  ): Promise<Message> {
    const [conversation, config] = await Promise.all([
      this.conversationRepository.findById(conversationId),
      this.businessConfigRepository.findByTenant(),
    ]);
    if (!conversation) throw new ConversationNotFoundError(conversationId);
    if (!config) throw new BusinessConfigNotFoundError();

    const sent = await this.messaging.sendText({
      tenantId: config.tenantId,
      toE164: conversation.clientPhoneE164,
      text: dto.text,
    });
    const sentAt = this.clock.now();
    const message = await this.messageRepository.recordIfNew({
      conversationId: conversation.id,
      providerMessageId: sent.providerMessageId,
      direction: MessageDirection.OUTBOUND,
      kind: MessageKind.TEXT,
      content: dto.text,
      occurredAt: sentAt,
    });
    if (!message) throw new InternalError(ErrorCode.INTERNAL_ERROR);

    // Taking over the conversation pauses the agent: from here on a human replies.
    await this.conversationRepository.recordManualReply(
      conversation.id,
      sentAt,
    );

    await this.audit.record({
      action: AuditAction.CONVERSATION_MANUAL_REPLY,
      entity: 'conversation',
      entityId: conversation.id,
      before: { botPaused: conversation.botPaused },
      after: { botPaused: true },
    });

    return message;
  }
}
