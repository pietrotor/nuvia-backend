export interface SendTextMessageInput {
  tenantId: string;
  toE164: string;
  text: string;
  // Time the provider keeps the "typing…" indicator on before delivering.
  // Absent for messages the owner wrote by hand: those were already typed.
  typingDelayMs?: number;
}

// Sending the bytes is what lets the same flow work whichever storage driver is
// configured: a local driver hands back file paths, and no provider can fetch those.
// A URL stays available for media that already lives on a public address.
export type OutboundMedia =
  | { source: 'url'; url: string }
  | { source: 'bytes'; bytes: Buffer };

export interface SendMediaMessageInput {
  tenantId: string;
  toE164: string;
  media: OutboundMedia;
  mimeType: string;
  caption?: string;
}

export interface MarkAsReadInput {
  tenantId: string;
  toE164: string;
  providerMessageId: string;
}

export interface ShowTypingInput {
  tenantId: string;
  toE164: string;
  durationMs: number;
}

export interface MessagingPort {
  sendText(input: SendTextMessageInput): Promise<SentMessage>;
  sendMedia(input: SendMediaMessageInput): Promise<SentMessage>;
  // Turns the client's message blue. Only for messages the agent is answering:
  // a read receipt on a conversation waiting for a human is a lie to the client.
  markAsRead(input: MarkAsReadInput): Promise<void>;
  showTyping(input: ShowTypingInput): Promise<void>;
}

export interface SentMessage {
  providerMessageId: string;
}

export const MESSAGING_PORT = 'MessagingPort';
