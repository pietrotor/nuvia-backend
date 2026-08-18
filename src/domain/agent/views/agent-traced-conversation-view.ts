import { ClientSummary } from '@domain/clients/views/client-summary';
import { Conversation } from '@domain/conversations/entities/conversation.entity';

export interface AgentTracedConversationView {
  conversation: Conversation;
  client: ClientSummary | null;
  turns: number;
  errorTurns: number;
}

export interface AgentTracedConversationListResult {
  rows: AgentTracedConversationView[];
  total: number;
}
