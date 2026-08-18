import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';

export interface SyncConversationLabelInput {
  // Chat the association changed on, as Evolution reports it (a WhatsApp JID).
  chatJid: string;
  labelId: string;
  action: 'add' | 'remove';
}

// The owner added or removed the human-attention label from her WhatsApp Business
// app. This use case reflects that onto `botPaused`. It deliberately calls the
// repository directly and never re-applies the label, so it cannot bounce back
// out through ConversationHandoffLabelService.
@Injectable()
export class SyncConversationLabelUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    private readonly audit: AuditRecorder,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: SyncConversationLabelInput): Promise<void> {
    const config = await this.businessConfigs.findByTenant();
    if (!config?.agentPolicy.humanAttentionLabelSync) return;
    // A tenant may keep many labels; only the one Nuvi manages maps to handoff.
    if (
      !config.evolutionHumanLabelId ||
      config.evolutionHumanLabelId !== input.labelId
    ) {
      return;
    }

    const phone = this.toE164(input.chatJid);
    if (!phone) {
      this.logger.warn(
        `Ignored human-attention label ${input.action} for unresolvable chat ${input.chatJid}`,
        SyncConversationLabelUseCase.name,
      );
      return;
    }

    const conversation = await this.conversations.findByClientPhone(phone);
    if (!conversation) return;

    // Idempotent: WhatsApp may resend associations, and Nuvi's own outbound label
    // writes can echo back. Only act when the state actually needs to change, so
    // the auto-resume timer is not reset and the audit trail stays clean.
    if (input.action === 'add') {
      if (conversation.botPaused) return;
      const updated = await this.conversations.pauseBot(conversation.id);
      if (updated) {
        await this.audit.record({
          action: AuditAction.CONVERSATION_BOT_PAUSED,
          entity: 'conversation',
          entityId: updated.id,
          after: { source: 'whatsapp_label' },
        });
      }
      return;
    }

    if (!conversation.botPaused) return;
    const updated = await this.conversations.resumeBot(conversation.id);
    if (updated) {
      await this.audit.record({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        entity: 'conversation',
        entityId: updated.id,
        after: { source: 'whatsapp_label' },
      });
    }
  }

  // Domain stores E.164; a LID chat cannot be mapped to a phone here, so it is
  // skipped rather than guessed.
  private toE164(chatJid: string): string | null {
    if (chatJid.includes('@lid') || chatJid.includes('@g.us')) return null;
    const digits = chatJid.split('@')[0]?.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
}
