import { AgentEconomicsSummary } from '@domain/agent/views/agent-economics-summary';
import { AgentTraceSummary } from '@domain/agent/views/agent-trace-summary';
import { AgentTracedConversationListResult } from '@domain/agent/views/agent-traced-conversation-view';

export interface AgentTraceViewRepository {
  listConversations(input: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<AgentTracedConversationListResult>;

  listByConversation(conversationId: string): Promise<AgentTraceSummary[]>;

  summarizeEconomics(range: {
    from: Date;
    to: Date;
  }): Promise<AgentEconomicsSummary>;
}

export const AGENT_TRACE_VIEW_REPOSITORY = 'AgentTraceViewRepository';
