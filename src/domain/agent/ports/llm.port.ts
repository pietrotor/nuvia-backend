export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
  // Identical across the messages of a tenant, so a provider that supports prompt caching
  // can reuse it as a prefix. An adapter is free to ignore it.
  cacheable?: boolean;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmChatInput {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmChatResult {
  content: string | null;
  toolCalls: LlmToolCall[];
}

export interface LlmPort {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
}

export const LLM_PORT = 'LlmPort';
