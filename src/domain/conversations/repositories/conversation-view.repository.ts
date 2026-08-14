import { ClientSummary } from '@domain/clients/views/client-summary';
import { Conversation } from '../entities/conversation.entity';

// The inbox needs to know who it is talking to: a conversation can exist before there
// is a registered client, so the summary is optional.
export interface ConversationView {
  conversation: Conversation;
  client: ClientSummary | null;
}

export interface ConversationListResult {
  rows: ConversationView[];
  total: number;
}

export interface ConversationViewRepository {
  list(input: {
    limit: number;
    offset: number;
  }): Promise<ConversationListResult>;
}

export const CONVERSATION_VIEW_REPOSITORY = 'ConversationViewRepository';
