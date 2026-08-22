import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '@domain/common/exceptions';
import { OpenRouterLlmAdapter } from './openrouter-llm.adapter';

function buildConfig(values: Record<string, string> = {}): ConfigService {
  const defaults: Record<string, string> = {
    LLM_BASE_URL: 'https://openrouter.ai/api/v1',
    LLM_API_KEY: 'sk-or-test',
    LLM_MODEL: 'anthropic/claude-haiku-4.5',
    LLM_MAX_TOKENS: '512',
    LLM_HTTP_REFERER: 'https://nuvi.app',
    LLM_APP_TITLE: 'Nuvi',
    LLM_PROMPT_CACHE: 'true',
    LLM_PROMPT_CACHE_TTL: '5m',
    ...values,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => defaults[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('OpenRouterLlmAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('adds attribution headers, session sticky routing and an explicit cache breakpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hola' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.0001 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await new OpenRouterLlmAdapter(buildConfig()).chat({
      messages: [
        {
          role: 'system',
          content: 'Sos Vale, el asistente virtual del negocio.',
          cacheable: true,
        },
        {
          role: 'system',
          content: 'Fecha y hora de referencia: lunes 17 de agosto, 11:30.',
        },
        { role: 'user', content: 'Hola' },
      ],
      sessionId: 'conversation-123',
      tools: [
        {
          name: 'list_services',
          description: 'Lista servicios.',
          parameters: { type: 'object', properties: {} },
        },
      ],
      toolChoice: 'any',
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['HTTP-Referer']).toBe('https://nuvi.app');
    expect(headers['X-Title']).toBe('Nuvi');
    expect(headers['x-session-id']).toBe('conversation-123');

    const body = JSON.parse(String(init.body)) as {
      tool_choice: string;
      session_id: string;
      cache_control?: unknown;
      provider: Record<string, unknown>;
      messages: Array<{
        role: string;
        content: string | Array<Record<string, unknown>>;
      }>;
    };
    expect(body.tool_choice).toBe('required');
    expect(body.session_id).toBe('conversation-123');
    expect(body.cache_control).toBeUndefined();
    expect(body.provider).toEqual({
      require_parameters: true,
      data_collection: 'deny',
      zdr: true,
      sort: 'price',
    });
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: [
        {
          type: 'text',
          text: 'Sos Vale, el asistente virtual del negocio.',
          cache_control: { type: 'ephemeral' },
        },
      ],
    });
    expect(body.messages[1]).toEqual({
      role: 'system',
      content: 'Fecha y hora de referencia: lunes 17 de agosto, 11:30.',
    });
  });

  it('can disable prompt caching and omit attribution headers', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Hola' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await new OpenRouterLlmAdapter(
      buildConfig({
        LLM_HTTP_REFERER: '',
        LLM_APP_TITLE: '  ',
        LLM_PROMPT_CACHE: 'false',
      }),
    ).chat({
      messages: [
        { role: 'system', content: 'Estático.', cacheable: true },
        { role: 'user', content: 'Hola' },
      ],
    });

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['X-Title']).toBeUndefined();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      cache_control?: unknown;
      messages: Array<{ content: unknown }>;
    };
    expect(body.cache_control).toBeUndefined();
    expect(body.messages[0].content).toBe('Estático.');
  });

  it('supports the 1h cache TTL on the explicit breakpoint', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Hola' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await new OpenRouterLlmAdapter(
      buildConfig({ LLM_PROMPT_CACHE_TTL: '1h' }),
    ).chat({
      messages: [
        { role: 'system', content: 'Estático.', cacheable: true },
        { role: 'user', content: 'Hola' },
      ],
      sessionId: 'c1',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      cache_control?: unknown;
      messages: Array<{
        content: Array<{ cache_control?: Record<string, unknown> }>;
      }>;
    };
    expect(body.cache_control).toBeUndefined();
    expect(body.messages[0].content[0].cache_control).toEqual({
      type: 'ephemeral',
      ttl: '1h',
    });
  });

  it('caps reasoning effort when configured and leaves it to the model otherwise', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ choices: [{ message: { content: 'Hola' } }] }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      );
    const messages = [{ role: 'user' as const, content: 'Hola' }];

    await new OpenRouterLlmAdapter(buildConfig()).chat({ messages });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)),
    ).not.toHaveProperty('reasoning');

    await new OpenRouterLlmAdapter(
      buildConfig({ LLM_REASONING_EFFORT: 'low' }),
    ).chat({ messages });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).reasoning,
    ).toEqual({ effort: 'low' });

    await expect(
      new OpenRouterLlmAdapter(
        buildConfig({ LLM_REASONING_EFFORT: 'minimal' }),
      ).chat({ messages }),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_NOT_CONFIGURED });
  });

  it('omits temperature so zero data retention endpoints stay routable', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Hola' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await new OpenRouterLlmAdapter(
      buildConfig({
        LLM_MODEL: 'google/gemini-3.7-flash',
        LLM_TEMPERATURE: '',
      }),
    ).chat({ messages: [{ role: 'user', content: 'Hola' }] });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      provider: Record<string, unknown>;
    };
    expect(body).not.toHaveProperty('temperature');
    expect(body.provider.zdr).toBe(true);
    expect(body.provider.require_parameters).toBe(true);
  });

  it('forces a named tool through the OpenAI-compatible tool_choice shape', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: null } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await new OpenRouterLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Sí' }],
      tools: [
        {
          name: 'book_appointment',
          description: 'Agenda.',
          parameters: { type: 'object', properties: {} },
        },
      ],
      toolChoice: { type: 'tool', name: 'book_appointment' },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      tool_choice: unknown;
    };
    expect(body.tool_choice).toEqual({
      type: 'function',
      function: { name: 'book_appointment' },
    });
  });

  it('identifies OpenRouter in provider failure diagnostics', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      new OpenRouterLlmAdapter(buildConfig()).chat({
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_PROVIDER_ERROR,
      params: expect.objectContaining({
        provider: 'openrouter',
        status: 200,
      }),
    });
  });
});
