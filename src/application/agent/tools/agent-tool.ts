import { LlmToolDefinition } from '@domain/agent/ports/llm.port';

export interface AgentContext {
  tenantId: string;
  conversationId: string;
  clientId: string;
  clientPhoneE164: string;
}

export interface AgentToolResult {
  status: 'success' | 'warning' | 'error';
  summary: string;
  data?: unknown;
  nextActions?: string[];
}

export interface AgentTool {
  readonly definition: LlmToolDefinition;
  execute(input: unknown, context: AgentContext): Promise<AgentToolResult>;
}

export const AGENT_TOOLS = 'AgentTools';
