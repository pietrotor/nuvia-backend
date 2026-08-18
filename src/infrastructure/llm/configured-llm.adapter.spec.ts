import { ConfigService } from '@nestjs/config';

import { InternalError } from '@domain/common/exceptions';
import { AnthropicLlmAdapter } from './anthropic-llm.adapter';
import { ConfiguredLlmAdapter } from './configured-llm.adapter';
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-llm.adapter';
import { OpenRouterLlmAdapter } from './openrouter-llm.adapter';

describe('ConfiguredLlmAdapter', () => {
  const input = { messages: [{ role: 'user' as const, content: 'Hola' }] };

  function build(
    provider: string | undefined,
    deps: {
      anthropic?: Partial<AnthropicLlmAdapter>;
      openAi?: Partial<OpenAiCompatibleLlmAdapter>;
      openRouter?: Partial<OpenRouterLlmAdapter>;
    } = {},
  ): ConfiguredLlmAdapter {
    return new ConfiguredLlmAdapter(
      {
        get: jest.fn((_key: string, fallback?: string) => provider ?? fallback),
      } as unknown as ConfigService,
      {
        chat: jest
          .fn()
          .mockResolvedValue({ content: 'anthropic', toolCalls: [] }),
        ...deps.anthropic,
      } as unknown as AnthropicLlmAdapter,
      {
        chat: jest.fn().mockResolvedValue({ content: 'openai', toolCalls: [] }),
        ...deps.openAi,
      } as unknown as OpenAiCompatibleLlmAdapter,
      {
        chat: jest
          .fn()
          .mockResolvedValue({ content: 'openrouter', toolCalls: [] }),
        ...deps.openRouter,
      } as unknown as OpenRouterLlmAdapter,
    );
  }

  it('defaults to OpenRouter without changing the application contract', async () => {
    const adapter = build(undefined);
    const openRouter = (
      adapter as unknown as { openRouter: OpenRouterLlmAdapter }
    ).openRouter;
    const openAi = (
      adapter as unknown as { openAiCompatible: OpenAiCompatibleLlmAdapter }
    ).openAiCompatible;

    await expect(adapter.chat(input)).resolves.toEqual({
      content: 'openrouter',
      toolCalls: [],
    });
    expect(openRouter.chat).toHaveBeenCalledWith(input);
    expect(openAi.chat).not.toHaveBeenCalled();
  });

  it('selects Anthropic without changing the application contract', async () => {
    const anthropicChat = jest
      .fn()
      .mockResolvedValue({ content: 'Hola', toolCalls: [] });
    const openAiChat = jest.fn();
    const openRouterChat = jest.fn();
    const adapter = build('anthropic', {
      anthropic: { chat: anthropicChat },
      openAi: { chat: openAiChat },
      openRouter: { chat: openRouterChat },
    });

    await expect(adapter.chat(input)).resolves.toEqual({
      content: 'Hola',
      toolCalls: [],
    });
    expect(anthropicChat).toHaveBeenCalledWith(input);
    expect(openAiChat).not.toHaveBeenCalled();
    expect(openRouterChat).not.toHaveBeenCalled();
  });

  it('selects the generic OpenAI-compatible adapter when configured', async () => {
    const openAiChat = jest
      .fn()
      .mockResolvedValue({ content: 'openai', toolCalls: [] });
    const openRouterChat = jest.fn();
    const adapter = build('openai-compatible', {
      openAi: { chat: openAiChat },
      openRouter: { chat: openRouterChat },
    });

    await expect(adapter.chat(input)).resolves.toEqual({
      content: 'openai',
      toolCalls: [],
    });
    expect(openAiChat).toHaveBeenCalledWith(input);
    expect(openRouterChat).not.toHaveBeenCalled();
  });

  it('selects OpenRouter when configured explicitly', async () => {
    const openRouterChat = jest
      .fn()
      .mockResolvedValue({ content: 'openrouter', toolCalls: [] });
    const openAiChat = jest.fn();
    const adapter = build('openrouter', {
      openAi: { chat: openAiChat },
      openRouter: { chat: openRouterChat },
    });

    await expect(adapter.chat(input)).resolves.toEqual({
      content: 'openrouter',
      toolCalls: [],
    });
    expect(openRouterChat).toHaveBeenCalledWith(input);
    expect(openAiChat).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider configuration', () => {
    const adapter = build('unknown-provider');
    expect(() => adapter.chat(input)).toThrow(InternalError);
  });
});
