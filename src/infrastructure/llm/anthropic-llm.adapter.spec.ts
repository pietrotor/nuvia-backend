import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '@domain/common/exceptions';
import { AnthropicLlmAdapter } from './anthropic-llm.adapter';

function buildConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      const defaults: Record<string, string> = {
        LLM_BASE_URL: 'https://api.anthropic.com',
        LLM_API_KEY: 'test-key',
        LLM_MODEL: 'claude-sonnet-5',
        LLM_PROMPT_CACHE: 'true',
        ...values,
      };
      return defaults[key] ?? fallback;
    }),
  } as unknown as ConfigService;
}

function stubResponse(): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'Hola.' }] }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    ),
  );
}

function sentToolChoice(fetchMock: jest.SpyInstance): unknown {
  const body = JSON.parse(
    String((fetchMock.mock.calls[0][1] as RequestInit)?.body),
  ) as { tool_choice?: unknown };
  return body.tool_choice;
}

const tools = [
  {
    name: 'book_appointment',
    description: 'Agenda un turno.',
    parameters: { type: 'object', properties: {} },
  },
];

describe('AnthropicLlmAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('honours the configured temperature and omits it when empty', async () => {
    const fetchMock = stubResponse();
    const messages = [{ role: 'user' as const, content: 'Hola.' }];

    await new AnthropicLlmAdapter(buildConfig()).chat({ messages });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).temperature,
    ).toBe(0.2);

    await new AnthropicLlmAdapter(buildConfig({ LLM_TEMPERATURE: '' })).chat({
      messages,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)),
    ).not.toHaveProperty('temperature');
  });

  it('lets the model decide by default', async () => {
    const fetchMock = stubResponse();

    await new AnthropicLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola.' }],
      tools,
    });

    expect(sentToolChoice(fetchMock)).toEqual({ type: 'auto' });
  });

  it('forces a tool call when the caller asks for one', async () => {
    const fetchMock = stubResponse();

    await new AnthropicLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola.' }],
      tools,
      toolChoice: 'any',
    });

    expect(sentToolChoice(fetchMock)).toEqual({ type: 'any' });
  });

  it('forces a named tool when the caller asks for one', async () => {
    const fetchMock = stubResponse();

    await new AnthropicLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Sí.' }],
      tools,
      toolChoice: { type: 'tool', name: 'book_appointment' },
    });

    expect(sentToolChoice(fetchMock)).toEqual({
      type: 'tool',
      name: 'book_appointment',
    });
  });

  it('omits the tool choice when there are no tools to call', async () => {
    const fetchMock = stubResponse();

    await new AnthropicLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola.' }],
    });

    expect(sentToolChoice(fetchMock)).toBeUndefined();
  });

  it('maps the neutral LLM contract to Anthropic tool use', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { type: 'text', text: 'Encontré opciones.' },
            {
              type: 'tool_use',
              id: 'toolu_2',
              name: 'find_availability',
              input: { serviceId: 'service-id' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const adapter = new AnthropicLlmAdapter(buildConfig());

    const result = await adapter.chat({
      messages: [
        {
          role: 'system',
          content: 'Sos un asistente virtual.',
          cacheable: true,
        },
        { role: 'system', content: 'Ahora es martes.' },
        { role: 'user', content: 'Quiero reservar.' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'toolu_1', name: 'list_services', arguments: '{}' },
          ],
        },
        {
          role: 'tool',
          name: 'list_services',
          toolCallId: 'toolu_1',
          content: '{"status":"success"}',
        },
      ],
      tools: [
        {
          name: 'list_services',
          description: 'Lista servicios.',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.content).toBe('Encontré opciones.');
    expect(result.toolCalls).toEqual([
      {
        id: 'toolu_2',
        name: 'find_availability',
        arguments: '{"serviceId":"service-id"}',
      },
    ]);

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(String(request[1]?.body)) as {
      system: { type: string; text: string; cache_control?: unknown }[];
      tools: { input_schema: unknown }[];
      messages: { role: string; content: unknown }[];
    };
    expect(body.system).toEqual([
      {
        type: 'text',
        text: 'Sos un asistente virtual.',
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: 'Ahora es martes.' },
    ]);
    expect(body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: {},
    });
    expect(body.messages).toEqual([
      { role: 'user', content: 'Quiero reservar.' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_services',
            input: {},
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: '{"status":"success"}',
          },
        ],
      },
    ]);
  });

  it('maps cache write and read tokens from Anthropic usage', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Hola.' }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 12,
            output_tokens: 3,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 20,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await new AnthropicLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola.' }],
    });

    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 3,
      cachedPromptTokens: 100,
      cacheWriteTokens: 20,
    });
    expect(result.finishReason).toBe('stop');
  });

  it('preserves safe provider diagnostics without storing its message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'rate_limit_error',
            message: 'sensitive upstream detail',
          },
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      new AnthropicLlmAdapter(buildConfig()).chat({
        messages: [{ role: 'user', content: 'Hola.' }],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_PROVIDER_ERROR,
      params: {
        provider: 'anthropic',
        status: 429,
        model: 'claude-sonnet-5',
        error_type: 'rate_limit_error',
      },
    });
  });
});
