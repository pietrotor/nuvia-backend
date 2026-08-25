import { LlmToolDefinition } from '@domain/agent/ports/llm.port';
import { AgentCommittedAction } from '@domain/agent/services/agent-action';

export interface AgentContext {
  tenantId: string;
  conversationId: string;
  clientId: string;
  clientPhoneE164: string;
  // Resolved by the orchestrator so a tool can label an instant in the hours the client
  // actually keeps, instead of handing the model a UTC string to convert on its own.
  timezone: string;
  // Null when the tenant has multiple active branches and none is pinned yet.
  branchId: string | null;
  quotedProviderMessageId?: string | null;
}

// What the caller knows before the orchestrator resolves timezone and branch.
export type InboundAgentContext = Omit<
  AgentContext,
  'timezone' | 'branchId' | 'quotedProviderMessageId'
>;

// An outbound the client is owed regardless of what the LLM writes next: the tool that
// knows it is due says so, and the agent flow sends it after its own reply. Asking the
// model to remember would make the deposit QR a coin flip.
export interface AgentFollowUp {
  kind: 'deposit_qr';
  appointmentId: string;
}

export interface AgentToolResult {
  status: 'success' | 'warning' | 'error';
  summary: string;
  data?: unknown;
  nextActions?: string[];
  followUp?: AgentFollowUp;
  // Resource-bound proof of a mutation. Only present after the use case committed.
  // Warnings and errors must never set this — a fluent summary is not evidence.
  committedAction?: AgentCommittedAction;
  // Every clock time this result puts on the table, in any format the tool already uses
  // ("17:00", "09:00 a 18:00"). The answer is checked against them, so a tool that returns
  // times and stays quiet here is a tool whose times the agent will not be allowed to say.
  offerableTimes?: string[];
  // When true, any clock time not in offerableTimes is invented — even if offerableTimes
  // is empty (day/period choice must not name exact hours).
  forbidsUnlistedClockTimes?: boolean;
}

export interface AgentTool {
  readonly definition: LlmToolDefinition;
  execute(input: unknown, context: AgentContext): Promise<AgentToolResult>;
}

export const AGENT_TOOLS = 'AgentTools';
