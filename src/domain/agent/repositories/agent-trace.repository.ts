import { AgentTrace } from '../entities/agent-trace.entity';

export interface AgentTraceRepository {
  save(trace: AgentTrace): Promise<AgentTrace>;
  findById(id: string): Promise<AgentTrace | null>;
  pruneOlderThan(cutoff: Date): Promise<number>;
}

export const AGENT_TRACE_REPOSITORY = 'AgentTraceRepository';
