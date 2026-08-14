import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LlmChatInput,
  LlmChatResult,
  LlmPort,
  LlmToolCall,
} from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';

@Injectable()
export class OpenAiCompatibleLlmAdapter implements LlmPort {
  constructor(private readonly config: ConfigService) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const baseUrl = this.config.get<string>('LLM_BASE_URL');
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const model = this.config.get<string>('LLM_MODEL');
    if (!baseUrl || !apiKey || !model) {
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED);
    }

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: input.messages.map((message) => ({
              role: message.role,
              content: message.content,
              name: message.name,
              tool_call_id: message.toolCallId,
              tool_calls: message.toolCalls?.map((call) => ({
                id: call.id,
                type: 'function',
                function: {
                  name: call.name,
                  arguments: call.arguments,
                },
              })),
            })),
            tools: input.tools?.map((tool) => ({
              type: 'function',
              function: tool,
            })),
            // "required" is this API's spelling of Anthropic's "any": call some tool.
            tool_choice: input.tools?.length
              ? input.toolChoice === 'any'
                ? 'required'
                : 'auto'
              : undefined,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (!response.ok) {
        throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);
      }

      const payload = (await response.json()) as {
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: {
              id: string;
              function: { name: string; arguments: string };
            }[];
          };
        }[];
      };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);

      const toolCalls: LlmToolCall[] = (message.tool_calls ?? []).map(
        (call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        }),
      );
      return { content: message.content ?? null, toolCalls };
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(ErrorCode.LLM_PROVIDER_ERROR);
    }
  }
}
