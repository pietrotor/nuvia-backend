import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LlmChatInput,
  LlmChatResult,
  LlmMessage,
  LlmPort,
  LlmToolCall,
} from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';

type AnthropicContentBlock =
  | { type: 'text'; text: string }
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
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED);
    }

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
          system: input.messages
            .filter((message) => message.role === 'system')
            .map((message) => message.content)
            .join('\n\n'),
          messages: this.toAnthropicMessages(
            input.messages.filter((message) => message.role !== 'system'),
          ),
          tools: input.tools?.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters,
          })),
          tool_choice: input.tools?.length
            ? { type: input.toolChoice ?? 'auto' }
            : undefined,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);
      }

      return this.toDomainResult((await response.json()) as AnthropicResponse);
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);
    }
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

  private toDomainResult(payload: AnthropicResponse): LlmChatResult {
    if (!payload.content) {
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);
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
    return { content: text || null, toolCalls };
  }

  private messagesUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/$/, '');
    return normalized.endsWith('/v1')
      ? `${normalized}/messages`
      : `${normalized}/v1/messages`;
  }
}
