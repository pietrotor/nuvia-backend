import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import { ConversationNotFoundError } from '@domain/conversations/exceptions/conversation.exceptions';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import { ConversationHandoffLabelService } from '../services/conversation-handoff-label.service';

@Injectable()
export class PauseConversationBotUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    private readonly audit: AuditRecorder,
    private readonly handoffLabel: ConversationHandoffLabelService,
  ) {}

  async execute(conversationId: string): Promise<Conversation> {
    const conversation =
      await this.conversationRepository.pauseBot(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    await this.audit.record({
      action: AuditAction.CONVERSATION_BOT_PAUSED,
      entity: 'conversation',
      entityId: conversation.id,
      after: { source: 'panel' },
    });

    await this.handoffLabel.markAttention(conversation);

    return conversation;
  }
}
