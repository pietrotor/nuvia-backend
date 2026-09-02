import { ConfigService } from '@nestjs/config';

import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-llm.adapter';

function buildConfig(values: Record<string, string> = {}): ConfigService {
  const defaults: Record<string, string> = {
    LLM_BASE_URL: 'https://api.example.com/v1/',
    LLM_API_KEY: 'test-key',
    LLM_MODEL: 'test-model',
    LLM_MAX_TOKENS: '1024',
    ...values,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => defaults[key] ?? fallback),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const tools = [
  {
    name: 'book_appointment',
    description: 'Agenda un turno.',
    parameters: { type: 'object', properties: {} },
  },
];

// Answers headers right away and then never completes the body, the way the
// provider behaves while it waits on a wedged upstream model.
function stalledResponse(signal: AbortSignal): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      new Promise((_resolve, reject) => {
        const fail = () => reject(new Error('body aborted'));
        if (signal.aborted) {
          fail();
          return;
        }
        signal.addEventListener('abort', fail);
      }),
  } as unknown as Response;
}

describe('OpenAiCompatibleLlmAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('posts to chat completions without a trailing slash on the base URL', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'Hola' } }] }),
      );

    await new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola' }],
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.com/v1/chat/completions',
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.authorization).toBe('Bearer test-key');
  });

  it('maps tool_choice any to required, auto by default, and named tools', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ choices: [{ message: { content: null } }] }),
        ),
      );
    const adapter = new OpenAiCompatibleLlmAdapter(buildConfig());

    await adapter.chat({
      messages: [{ role: 'user', content: 'Hola' }],
      tools,
      toolChoice: 'any',
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).tool_choice,
    ).toBe('required');

    await adapter.chat({
      messages: [{ role: 'user', content: 'Hola' }],
      tools,
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).tool_choice,
    ).toBe('auto');

    await adapter.chat({ messages: [{ role: 'user', content: 'Hola' }] });
    expect(
      JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).tool_choice,
    ).toBeUndefined();

    await adapter.chat({
      messages: [{ role: 'user', content: 'Sí' }],
      tools,
      toolChoice: { type: 'tool', name: 'book_appointment' },
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).tool_choice,
    ).toEqual({
      type: 'function',
      function: { name: 'book_appointment' },
    });
  });

  it('ignores cacheable markers on the base OpenAI-compatible path', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'Hola' } }] }),
      );

    await new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
      messages: [
        { role: 'system', content: 'Estático.', cacheable: true },
        { role: 'system', content: 'Volátil.' },
        { role: 'user', content: 'Hola' },
      ],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: unknown }>;
    };
    expect(body.messages[0].content).toBe('Estático.');
    expect(body.messages[1].content).toBe('Volátil.');
  });

  it('sends max_tokens and rejects an invalid limit', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      );

    await new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
      messages: [{ role: 'user', content: 'Hola' }],
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).max_tokens,
    ).toBe(1024);

    await expect(
      new OpenAiCompatibleLlmAdapter(buildConfig({ LLM_MAX_TOKENS: '0' })).chat(
        { messages: [{ role: 'user', content: 'Hola' }] },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_NOT_CONFIGURED });
  });

  it('omits temperature when LLM_TEMPERATURE is empty and rejects invalid values', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
        ),
      );
    const message = { role: 'user' as const, content: 'Hola' };

    await new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
      messages: [message],
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).temperature,
    ).toBe(0.2);

    await new OpenAiCompatibleLlmAdapter(
      buildConfig({ LLM_TEMPERATURE: '' }),
    ).chat({ messages: [message] });
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)),
    ).not.toHaveProperty('temperature');

    await new OpenAiCompatibleLlmAdapter(
      buildConfig({ LLM_TEMPERATURE: '0' }),
    ).chat({ messages: [message] });
    expect(
      JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).temperature,
    ).toBe(0);

    await expect(
      new OpenAiCompatibleLlmAdapter(
        buildConfig({ LLM_TEMPERATURE: 'warm' }),
      ).chat({ messages: [message] }),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_NOT_CONFIGURED });
  });

  it('round-trips tool messages and normalizes content blocks', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        model: 'routed-model',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 4,
          cost: 0.0012,
          prompt_tokens_details: {
            cached_tokens: 3,
            cache_write_tokens: 7,
          },
        },
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: [{ type: 'text', text: 'Listo.' }],
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'find_availability',
                    arguments: '{"serviceId":"s1"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
      messages: [
        { role: 'system', content: 'Sos un asistente.' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_0', name: 'list_services', arguments: '{}' }],
        },
        {
          role: 'tool',
          name: 'list_services',
          toolCallId: 'call_0',
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

    expect(result).toEqual({
      content: 'Listo.',
      toolCalls: [
        {
          id: 'call_1',
          name: 'find_availability',
          arguments: '{"serviceId":"s1"}',
        },
      ],
      model: 'routed-model',
      usage: {
        promptTokens: 10,
        completionTokens: 4,
        cachedPromptTokens: 3,
        cacheWriteTokens: 7,
        costCredits: 0.0012,
      },
      finishReason: 'tool_calls',
    });
  });

  it('rejects HTTP errors and embedded provider errors without leaking bodies', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'secret prompt leaked here',
            metadata: { error_type: 'rate_limit_exceeded' },
          },
        },
        429,
      ),
    );

    await expect(
      new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: ErrorCode.LLM_PROVIDER_ERROR,
        params: expect.objectContaining({
          provider: 'openai-compatible',
          status: 429,
          model: 'test-model',
          error_type: 'rate_limit_exceeded',
        }),
      }),
    );

    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        choices: [
          {
            finish_reason: 'error',
            error: {
              message: 'provider disconnected',
              metadata: { error_type: 'provider_unavailable' },
            },
            message: { content: 'partial' },
          },
        ],
      }),
    );

    await expect(
      new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toBeInstanceOf(InternalError);
  });

  it('reports a body that outlived the budget as a timeout, not a parse failure', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation((_url, init) =>
        Promise.resolve(stalledResponse(init?.signal as AbortSignal)),
      );

    await expect(
      new OpenAiCompatibleLlmAdapter(
        buildConfig({ LLM_TIMEOUT_MS: '20' }),
      ).chat({ messages: [{ role: 'user', content: 'Hola' }] }),
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_PROVIDER_ERROR,
      params: expect.objectContaining({ status: 200, cause: 'timeout' }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a stalled attempt once and keeps the answer of the second', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementationOnce((_url, init) =>
        Promise.resolve(stalledResponse(init?.signal as AbortSignal)),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse({ choices: [{ message: { content: 'Hola' } }] }),
        ),
      );

    const result = await new OpenAiCompatibleLlmAdapter(
      buildConfig({ LLM_TIMEOUT_MS: '20' }),
    ).chat({ messages: [{ role: 'user', content: 'Hola' }] });

    expect(result.content).toBe('Hola');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error the provider answered on purpose', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ error: { message: 'slow down' } }, 429),
      );

    await expect(
      new OpenAiCompatibleLlmAdapter(buildConfig()).chat({
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_PROVIDER_ERROR });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid timeout budget', async () => {
    await expect(
      new OpenAiCompatibleLlmAdapter(
        buildConfig({ LLM_TIMEOUT_MS: 'soon' }),
      ).chat({ messages: [{ role: 'user', content: 'Hola' }] }),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_NOT_CONFIGURED });
  });

  it('requires base URL, API key and model', async () => {
    await expect(
      new OpenAiCompatibleLlmAdapter(buildConfig({ LLM_API_KEY: '' })).chat({
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.LLM_NOT_CONFIGURED });
  });
});
