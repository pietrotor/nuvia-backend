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

// "any" makes the provider prefill the assistant turn so the model has to call one of the
// tools. It cannot answer in prose on that round, which is the point: it is how we make an
// action happen instead of letting the model narrate one it never took.
// `{ type: 'tool', name }` forces that specific tool on the first round of a turn.
export type LlmToolChoice = 'auto' | 'any' | { type: 'tool'; name: string };

export interface LlmChatInput {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  toolChoice?: LlmToolChoice;
  // Stable across turns of one conversation so a router can pin provider sticky caching.
  sessionId?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number;
  cacheWriteTokens?: number;
  // Credits charged by a billing-aware provider (e.g. OpenRouter). Optional so
  // adapters that only return token counts stay valid.
  costCredits?: number;
}

export type LlmFinishReason =
  | 'stop'
  | 'tool_calls'
  | 'length'
  | 'content_filter'
  | 'error'
  | 'other';

export interface LlmChatResult {
  content: string | null;
  toolCalls: LlmToolCall[];
  model?: string;
  usage?: LlmUsage;
  finishReason?: LlmFinishReason;
}

export interface LlmPort {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
}

export const LLM_PORT = 'LlmPort';
