import {
  AgentTone,
  EmojiPolicy,
} from '@domain/business-config/entities/business-config.entity';

export interface TenantVoice {
  agentName: string;
  tone: AgentTone;
  emojiPolicy: EmojiPolicy;
  businessNotes: string | null;
}
