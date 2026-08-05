import {
  Message,
  MessageDirection,
  MessageKind,
} from '../entities/message.entity';

export interface RecordMessageData {
  conversationId: string;
  providerMessageId: string;
  inReplyToProviderMessageId?: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  content: string | null;
  promptFingerprint?: string | null;
  occurredAt: Date;
}

export interface MessageRepository {
  recordIfNew(data: RecordMessageData): Promise<Message | null>;
  hasReplyTo(providerMessageId: string): Promise<boolean>;
  findRecent(conversationId: string, limit: number): Promise<Message[]>;
  findByConversation(
    conversationId: string,
    input: { limit: number; offset: number },
  ): Promise<Message[]>;
}

export const MESSAGE_REPOSITORY = 'MessageRepository';
