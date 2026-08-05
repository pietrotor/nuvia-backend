import { ConfigService } from '@nestjs/config';

import { InternalError } from '@domain/common/exceptions';
import { AnthropicLlmAdapter } from './anthropic-llm.adapter';
import { ConfiguredLlmAdapter } from './configured-llm.adapter';
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-llm.adapter';

describe('ConfiguredLlmAdapter', () => {
  const input = { messages: [{ role: 'user' as const, content: 'Hola' }] };

  it('selects Anthropic without changing the application contract', async () => {
    const anthropic = {
      chat: jest.fn().mockResolvedValue({ content: 'Hola', toolCalls: [] }),
    } as unknown as AnthropicLlmAdapter;
    const openAi = {
      chat: jest.fn(),
    } as unknown as OpenAiCompatibleLlmAdapter;
    const adapter = new ConfiguredLlmAdapter(
      {
        get: jest.fn().mockReturnValue('anthropic'),
      } as unknown as ConfigService,
      anthropic,
      openAi,
    );

    await expect(adapter.chat(input)).resolves.toEqual({
      content: 'Hola',
      toolCalls: [],
    });
    expect(anthropic.chat).toHaveBeenCalledWith(input);
    expect(openAi.chat).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider configuration', () => {
    const adapter = new ConfiguredLlmAdapter(
      {
        get: jest.fn().mockReturnValue('unknown-provider'),
      } as unknown as ConfigService,
      {} as AnthropicLlmAdapter,
      {} as OpenAiCompatibleLlmAdapter,
    );

    expect(() => adapter.chat(input)).toThrow(InternalError);
  });
});
