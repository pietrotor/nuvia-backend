// A WhatsApp Business label the business can see next to a chat. Nuvi mirrors the
// "human attention" handoff state onto one such label so the owner sees, inside
// her own WhatsApp, which conversations the agent has stepped out of.
//
// Segregated from MessagingPort on purpose: sending messages and organising chats
// are different concerns, and a channel that cannot label chats (Meta Cloud API)
// can still implement MessagingPort untouched.
export interface EnsureHumanAttentionLabelInput {
  tenantId: string;
  // Owner-facing label text, e.g. "Requiere atención humana".
  name: string;
}

export interface HumanAttentionLabel {
  labelId: string;
  created: boolean;
}

export interface SetChatLabelInput {
  tenantId: string;
  labelId: string;
  toE164: string;
}

export interface ChatLabelPort {
  // Find-or-create the label by name and return its provider id. Idempotent.
  ensureHumanAttentionLabel(
    input: EnsureHumanAttentionLabelInput,
  ): Promise<HumanAttentionLabel>;
  addChatLabel(input: SetChatLabelInput): Promise<void>;
  removeChatLabel(input: SetChatLabelInput): Promise<void>;
}

export const CHAT_LABEL_PORT = 'ChatLabelPort';
