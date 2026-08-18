import { Injectable } from '@nestjs/common';

import { LlmChatInput, LlmMessage } from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-llm.adapter';

type OpenRouterCacheControl = {
  type: 'ephemeral';
  ttl?: '1h';
};

type OpenRouterTextPart = {
  type: 'text';
  text: string;
  cache_control?: OpenRouterCacheControl;
};

@Injectable()
export class OpenRouterLlmAdapter extends OpenAiCompatibleLlmAdapter {
  protected override extraHeaders(input: LlmChatInput): Record<string, string> {
    const headers: Record<string, string> = {};
    const referer = this.config.get<string>('LLM_HTTP_REFERER')?.trim();
    const title = this.config.get<string>('LLM_APP_TITLE')?.trim();
    if (referer) headers['HTTP-Referer'] = referer;
    if (title) headers['X-Title'] = title;
    const sessionId = input.sessionId?.trim();
    if (sessionId) headers['x-session-id'] = sessionId.slice(0, 256);
    return headers;
  }

  protected override extendBody(
    body: Record<string, unknown>,
    input: LlmChatInput,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {
      ...body,
      provider: {
        require_parameters: true,
        data_collection: 'deny',
        zdr: true,
        sort: 'price',
      },
    };

    const sessionId = input.sessionId?.trim();
    if (sessionId) {
      next.session_id = sessionId.slice(0, 256);
    }

    // Reasoning models bill thinking as completion tokens and some of them
    // (Gemini 3) refuse to disable it, so the effort level is the only lever.
    const reasoningEffort = this.reasoningEffort();
    if (reasoningEffort) {
      next.reasoning = { effort: reasoningEffort };
    }

    // Explicit breakpoints live on the cacheable system block (see mapMessages).
    // Top-level automatic cache_control would advance past volatile text and
    // rewrite the stable prefix on every WhatsApp turn.
    return next;
  }

  protected override mapMessages(
    messages: LlmMessage[],
  ): ReturnType<OpenAiCompatibleLlmAdapter['mapMessages']> {
    if (!this.promptCacheEnabled()) {
      return super.mapMessages(messages);
    }

    const systemMessages = messages.filter(
      (message) => message.role === 'system',
    );
    const cacheControl = this.cacheControl();

    return messages.map((message) => {
      const mapped = this.mapMessage(message);
      if (message.role !== 'system' || message.cacheable !== true) {
        return mapped;
      }

      // Cache only the last contiguous cacheable prefix block so volatile text
      // after it stays outside the breakpoint (tools + static prompt are reused).
      const systemIndex = systemMessages.indexOf(message);
      const isLastCacheable = systemMessages
        .slice(systemIndex + 1)
        .every((next) => next.cacheable !== true);
      if (!isLastCacheable) {
        return mapped;
      }

      const part: OpenRouterTextPart = {
        type: 'text',
        text: message.content,
        cache_control: cacheControl,
      };
      return { ...mapped, content: [part] };
    });
  }

  private reasoningEffort(): 'low' | 'medium' | 'high' | undefined {
    const raw = this.config.get<string>('LLM_REASONING_EFFORT')?.trim();
    if (!raw) return undefined;
    if (raw !== 'low' && raw !== 'medium' && raw !== 'high') {
      throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
        field: 'LLM_REASONING_EFFORT',
      });
    }
    return raw;
  }

  private promptCacheEnabled(): boolean {
    const raw = this.config.get<string>('LLM_PROMPT_CACHE', 'true')?.trim();
    return raw !== 'false' && raw !== '0';
  }

  private cacheControl(): OpenRouterCacheControl {
    return {
      type: 'ephemeral',
      ...(this.promptCacheTtl() === '1h' ? { ttl: '1h' as const } : {}),
    };
  }

  private promptCacheTtl(): '5m' | '1h' {
    const raw = this.config.get<string>('LLM_PROMPT_CACHE_TTL', '5m')?.trim();
    return raw === '1h' ? '1h' : '5m';
  }
}
