export interface AgentUsageViewRepository {
  countAgentRepliesBetween(range: { from: Date; to: Date }): Promise<number>;
}

export const AGENT_USAGE_VIEW_REPOSITORY = 'AgentUsageViewRepository';
