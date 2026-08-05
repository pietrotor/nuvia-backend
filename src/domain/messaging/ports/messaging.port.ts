export interface SendTextMessageInput {
  tenantId: string;
  toE164: string;
  text: string;
}

export interface SendMediaMessageInput {
  tenantId: string;
  toE164: string;
  mediaUrl: string;
  caption?: string;
  mimeType?: string;
}

export interface MessagingPort {
  sendText(input: SendTextMessageInput): Promise<SentMessage>;
  sendMedia(input: SendMediaMessageInput): Promise<SentMessage>;
}

export interface SentMessage {
  providerMessageId: string;
}

export const MESSAGING_PORT = 'MessagingPort';
