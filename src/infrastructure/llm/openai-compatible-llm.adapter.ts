import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LlmChatInput,
  LlmFinishReason,
  LlmMessage,
  LlmPort,
  LlmChatResult,
  LlmToolCall,
  LlmToolChoice,
  LlmUsage,
} from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { resolveTemperature } from './llm-sampling';
import {
  MAX_LLM_ATTEMPTS,
  isTransientLlmFailure,
  resolveTimeoutMs,
} from './llm-transport';

type OpenAiContentPart =
  | { type?: string; text?: string }
  | {
      type: 'text';
      text: string;
      cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
    };

type OpenAiRequestMessage = {
  role: LlmMessage['role'];
  content: string | OpenAiContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
};

type OpenAiToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

type OpenAiChoice = {
  finish_reason?: string | null;
  error?: { message?: string; metadata?: { error_type?: string } };
  message?: {
    content?: string | OpenAiContentPart[] | null;
    tool_calls?: OpenAiToolCall[];
  };
};

type OpenAiChatPayload = {
  model?: string;
  error?: {
    message?: string;
    code?: number | string;
    metadata?: { error_type?: string };
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
    };
  };
  choices?: OpenAiChoice[];
};

type ChatRequest = {
  url: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number | undefined;
  timeoutMs: number;
};

@Injectable()
export class OpenAiCompatibleLlmAdapter implements LlmPort {
  constructor(protected readonly config: ConfigService) {}

  protected get providerName(): string {
    return 'openai-compatible';
  }

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const baseUrl = this.config.get<string>('LLM_BASE_URL');
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const model = this.config.get<string>('LLM_MODEL');
    if (!baseUrl || !apiKey || !model) {
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
        provider: this.providerName,
      });
    }
    const request: ChatRequest = {
      url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      apiKey,
      model,
      maxTokens: this.maxTokens(),
      temperature: resolveTemperature(this.config),
      timeoutMs: resolveTimeoutMs(this.config),
    };

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.attempt(input, request);
      } catch (error) {
        if (attempt >= MAX_LLM_ATTEMPTS || !isTransientLlmFailure(error)) {
          throw error;
        }
      }
    }
  }

  private async attempt(
    input: LlmChatInput,
    request: ChatRequest,
  ): Promise<LlmChatResult> {
    const { model, temperature } = request;
    const signal = AbortSignal.timeout(request.timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.apiKey}`,
          'content-type': 'application/json',
          ...this.extraHeaders(input),
        },
        body: JSON.stringify(
          this.extendBody(
            {
              model,
              messages: this.mapMessages(input.messages),
              tools: input.tools?.map((tool) => ({
                type: 'function',
                function: tool,
              })),
              tool_choice: input.tools?.length
                ? this.mapToolChoice(input.toolChoice)
                : undefined,
              ...(temperature == null ? {} : { temperature }),
              max_tokens: request.maxTokens,
            },
            input,
          ),
        ),
        signal,
      });

      const payload = await this.readPayload(response, model, signal);
      this.assertSuccess(response, payload, model);

      const choice = payload.choices?.[0];
      const message = choice?.message;
      if (!message) {
        throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
          provider: this.providerName,
          status: response.status,
          model,
        });
      }

      const toolCalls: LlmToolCall[] = (message.tool_calls ?? []).map(
        (call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        }),
      );

      return {
        content: this.normalizeContent(message.content),
        toolCalls,
        model: payload.model ?? model,
        usage: this.mapUsage(payload.usage),
        finishReason: this.mapFinishReason(choice?.finish_reason, toolCalls),
      };
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        provider: this.providerName,
        model,
        cause: this.failureCause(error),
      });
    }
  }

  protected extraHeaders(_input: LlmChatInput): Record<string, string> {
    return {};
  }

  protected extendBody(
    body: Record<string, unknown>,
    _input: LlmChatInput,
  ): Record<string, unknown> {
    return body;
  }

  // Subclasses can attach provider-specific cache markers on content blocks.
  protected mapMessages(messages: LlmMessage[]): OpenAiRequestMessage[] {
    return messages.map((message) => this.mapMessage(message));
  }

  protected mapMessage(message: LlmMessage): OpenAiRequestMessage {
    return {
      role: message.role,
      content: message.content,
      name: message.name,
      tool_call_id: message.toolCallId,
      tool_calls: message.toolCalls?.map((call) => ({
        id: call.id,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: call.arguments,
        },
      })),
    };
  }

  // "required" is this API's spelling of Anthropic's "any": call some tool.
  protected mapToolChoice(
    toolChoice: LlmToolChoice | undefined,
  ): 'auto' | 'required' | { type: 'function'; function: { name: string } } {
    if (toolChoice == null || toolChoice === 'auto') return 'auto';
    if (toolChoice === 'any') return 'required';
    return {
      type: 'function',
      function: { name: toolChoice.name },
    };
  }

  private maxTokens(): number {
    const raw = this.config.get<string>('LLM_MAX_TOKENS', '1024');
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
        provider: this.providerName,
        field: 'LLM_MAX_TOKENS',
      });
    }
    return value;
  }

  // OpenRouter answers 200 and pads the body with whitespace while it waits on
  // the upstream model, so an expired budget surfaces as an unreadable body on
  // an otherwise healthy response, not as a rejected fetch.
  private async readPayload(
    response: Response,
    model: string,
    signal: AbortSignal,
  ): Promise<OpenAiChatPayload> {
    try {
      return (await response.json()) as OpenAiChatPayload;
    } catch {
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        provider: this.providerName,
        status: response.status,
        model,
        cause: signal.aborted ? 'timeout' : 'parse',
      });
    }
  }

  private assertSuccess(
    response: Response,
    payload: OpenAiChatPayload,
    model: string,
  ): void {
    const choice = payload.choices?.[0];
    const embeddedError = payload.error ?? choice?.error;
    const finishReason = choice?.finish_reason;
    const failed =
      !response.ok || embeddedError != null || finishReason === 'error';

    if (!failed) return;

    const errorType = embeddedError?.metadata?.error_type;
    throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
      provider: this.providerName,
      status: response.status,
      model,
      ...(errorType ? { error_type: errorType } : {}),
    });
  }

  private failureCause(error: unknown): 'timeout' | 'network' {
    return error instanceof Error && error.name === 'TimeoutError'
      ? 'timeout'
      : 'network';
  }

  private normalizeContent(
    content: string | OpenAiContentPart[] | null | undefined,
  ): string | null {
    if (content == null) return null;
    if (typeof content === 'string') return content;
    const text = content
      .filter((part) => part.type === 'text' || part.text != null)
      .map((part) => part.text ?? '')
      .join('');
    return text || null;
  }

  private mapUsage(
    usage: OpenAiChatPayload['usage'] | undefined,
  ): LlmUsage | undefined {
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      cachedPromptTokens: usage.prompt_tokens_details?.cached_tokens,
      cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens,
      costCredits: usage.cost,
    };
  }

  private mapFinishReason(
    reason: string | null | undefined,
    toolCalls: LlmToolCall[],
  ): LlmFinishReason | undefined {
    if (reason == null) {
      return toolCalls.length > 0 ? 'tool_calls' : undefined;
    }
    switch (reason) {
      case 'stop':
      case 'tool_calls':
      case 'length':
      case 'content_filter':
      case 'error':
        return reason;
      default:
        return 'other';
    }
  }
}
