import { Conversation } from '../entities/conversation.entity';

export interface ConversationRepository {
  findOrCreate(input: {
    clientPhoneE164: string;
    clientId: string;
    occurredAt: Date;
  }): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  setHandoff(id: string, reason: string): Promise<Conversation | null>;
  pauseBot(id: string): Promise<Conversation | null>;
  resumeBot(id: string): Promise<Conversation | null>;
  recordManualReply(id: string, occurredAt: Date): Promise<Conversation | null>;
}

export const CONVERSATION_REPOSITORY = 'ConversationRepository';
