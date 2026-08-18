import { Inject, Injectable } from '@nestjs/common';

import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import {
  CHAT_LABEL_PORT,
  ChatLabelPort,
} from '@domain/messaging/ports/chat-label.port';

// Mirrors the handoff (bot paused) state of a conversation onto the tenant's
// WhatsApp Business label. Every method is best-effort: `botPaused` in Postgres
// stays the source of truth, so a provider hiccup degrades the owner's visual
// cue but never fails the panel action or the agent reply that triggered it.
//
// Only panel/agent transitions call this. The reverse direction (owner toggles
// the label on her phone) is handled by SyncConversationLabelUseCase, which
// mutates the DB *without* re-applying the label — that asymmetry is the loop
// guard that keeps the two sides from ping-ponging.
@Injectable()
export class ConversationHandoffLabelService {
  constructor(
    @Inject(CHAT_LABEL_PORT)
    private readonly chatLabels: ChatLabelPort,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async markAttention(conversation: Conversation | null): Promise<void> {
    await this.reflect(conversation, 'add');
  }

  async clearAttention(conversation: Conversation | null): Promise<void> {
    await this.reflect(conversation, 'remove');
  }

  private async reflect(
    conversation: Conversation | null,
    action: 'add' | 'remove',
  ): Promise<void> {
    if (!conversation) return;
    try {
      const config = await this.businessConfigs.findByTenant();
      if (!config?.agentPolicy.humanAttentionLabelSync) return;

      const labelId = config.evolutionHumanLabelId;
      if (!labelId) {
        this.logger.warn(
          'Human-attention label sync is on but no label id is resolved yet; ' +
            'reconnect the WhatsApp session to provision it.',
          ConversationHandoffLabelService.name,
        );
        return;
      }

      const input = {
        tenantId: config.tenantId,
        labelId,
        toE164: conversation.clientPhoneE164,
      };
      if (action === 'add') {
        await this.chatLabels.addChatLabel(input);
      } else {
        await this.chatLabels.removeChatLabel(input);
      }
    } catch (error) {
      this.logger.warn(
        `Could not ${action} the human-attention label for conversation ${conversation.id}: ` +
          (error instanceof Error ? error.message : String(error)),
        ConversationHandoffLabelService.name,
      );
    }
  }
}
