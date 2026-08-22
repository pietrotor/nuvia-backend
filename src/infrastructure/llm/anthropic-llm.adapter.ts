import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LlmChatInput,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
  LlmPort,
  LlmToolCall,
} from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { resolveTemperature } from './llm-sampling';

type AnthropicContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  type?: string;
  error?: {
    type?: string;
    message?: string;
  };
  model?: string;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  content?: (
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  )[];
}

@Injectable()
export class AnthropicLlmAdapter implements LlmPort {
  constructor(private readonly config: ConfigService) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const baseUrl = this.config.get<string>('LLM_BASE_URL');
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const model = this.config.get<string>('LLM_MODEL');
    if (!baseUrl || !apiKey || !model) {
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
        provider: 'anthropic',
      });
    }

    const temperature = resolveTemperature(this.config);

    try {
      const response = await fetch(this.messagesUrl(baseUrl), {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: Number(this.config.get<string>('LLM_MAX_TOKENS', '1024')),
          system: this.toSystemBlocks(input.messages),
          messages: this.toAnthropicMessages(
            input.messages.filter((message) => message.role !== 'system'),
          ),
          tools: input.tools?.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters,
          })),
          tool_choice: input.tools?.length
            ? this.mapToolChoice(input.toolChoice)
            : undefined,
          ...(temperature == null ? {} : { temperature }),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const payload = await this.readPayload(response, model);
      if (!response.ok || payload.type === 'error' || payload.error) {
        throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
          provider: 'anthropic',
          status: response.status,
          model,
          ...(payload.error?.type ? { error_type: payload.error.type } : {}),
        });
      }

      return this.toDomainResult(payload, model);
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        provider: 'anthropic',
        model,
        cause: this.failureCause(error),
      });
    }
  }

  private toSystemBlocks(
    messages: LlmMessage[],
  ): string | AnthropicContentBlock[] {
    const systemMessages = messages.filter(
      (message) => message.role === 'system',
    );
    if (systemMessages.length === 0) return '';

    if (!this.promptCacheEnabled()) {
      return systemMessages.map((message) => message.content).join('\n\n');
    }

    return systemMessages.map((message, index) => {
      const block: AnthropicContentBlock = {
        type: 'text',
        text: message.content,
      };
      // Cache only the last contiguous cacheable prefix block so volatile text
      // after it stays outside the breakpoint.
      const isLastCacheable =
        message.cacheable === true &&
        systemMessages
          .slice(index + 1)
          .every((next) => next.cacheable !== true);
      if (message.cacheable === true && isLastCacheable) {
        block.cache_control = { type: 'ephemeral' };
      }
      return block;
    });
  }

  private mapToolChoice(
    toolChoice: LlmChatInput['toolChoice'],
  ): { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string } {
    if (toolChoice == null || toolChoice === 'auto') {
      return { type: 'auto' };
    }
    if (toolChoice === 'any') {
      return { type: 'any' };
    }
    return { type: 'tool', name: toolChoice.name };
  }

  private promptCacheEnabled(): boolean {
    const raw = this.config.get<string>('LLM_PROMPT_CACHE', 'true')?.trim();
    return raw !== 'false' && raw !== '0';
  }

  private toAnthropicMessages(messages: LlmMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];
    for (const message of messages) {
      if (message.role === 'tool') {
        const block: AnthropicContentBlock = {
          type: 'tool_result',
          tool_use_id: message.toolCallId ?? '',
          content: message.content,
        };
        const previous = result.at(-1);
        if (previous?.role === 'user' && Array.isArray(previous.content)) {
          previous.content.push(block);
        } else {
          result.push({ role: 'user', content: [block] });
        }
        continue;
      }

      if (message.role === 'assistant' && message.toolCalls?.length) {
        result.push({
          role: 'assistant',
          content: [
            ...(message.content
              ? [{ type: 'text' as const, text: message.content }]
              : []),
            ...message.toolCalls.map((call) => ({
              type: 'tool_use' as const,
              id: call.id,
              name: call.name,
              input: JSON.parse(call.arguments) as unknown,
            })),
          ],
        });
        continue;
      }

      result.push({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      });
    }
    return result;
  }

  private async readPayload(
    response: Response,
    model: string,
  ): Promise<AnthropicResponse> {
    try {
      return (await response.json()) as AnthropicResponse;
    } catch {
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        provider: 'anthropic',
        status: response.status,
        model,
        cause: 'parse',
      });
    }
  }

  private failureCause(error: unknown): 'timeout' | 'network' {
    return error instanceof Error && error.name === 'TimeoutError'
      ? 'timeout'
      : 'network';
  }

  private toDomainResult(
    payload: AnthropicResponse,
    configuredModel: string,
  ): LlmChatResult {
    if (!payload.content) {
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        provider: 'anthropic',
        model: payload.model ?? configuredModel,
      });
    }
    const text = payload.content
      .filter(
        (block): block is { type: 'text'; text: string } =>
          block.type === 'text',
      )
      .map((block) => block.text)
      .join('\n')
      .trim();
    const toolCalls: LlmToolCall[] = payload.content
      .filter(
        (
          block,
        ): block is {
          type: 'tool_use';
          id: string;
          name: string;
          input: unknown;
        } => block.type === 'tool_use',
      )
      .map((block) => ({
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
      }));
    const usage = payload.usage
      ? {
          promptTokens: payload.usage.input_tokens ?? 0,
          completionTokens: payload.usage.output_tokens ?? 0,
          cachedPromptTokens: payload.usage.cache_read_input_tokens,
          cacheWriteTokens: payload.usage.cache_creation_input_tokens,
        }
      : undefined;
    return {
      content: text || null,
      toolCalls,
      model: payload.model,
      usage,
      finishReason: this.mapFinishReason(payload.stop_reason, toolCalls),
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
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      case 'refusal':
        return 'content_filter';
      default:
        return 'other';
    }
  }

  private messagesUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/$/, '');
    return normalized.endsWith('/v1')
      ? `${normalized}/messages`
      : `${normalized}/v1/messages`;
  }
}
