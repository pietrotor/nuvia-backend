import { ConfigService } from '@nestjs/config';

import { AnthropicLlmAdapter } from './anthropic-llm.adapter';

function buildConfig(): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        LLM_BASE_URL: 'https://api.anthropic.com',
        LLM_API_KEY: 'test-key',
        LLM_MODEL: 'claude-sonnet-5',
      };
      return values[key] ?? fallback;
    }),
  } as unknown as ConfigService;
}

function stubResponse(): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ content: [{ type: 'text', text: 'Hola.' }] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
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
        { role: 'system', content: 'Sos un asistente virtual.' },
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

    expect(result).toEqual({
      content: 'Encontré opciones.',
      toolCalls: [
        {
          id: 'toolu_2',
          name: 'find_availability',
          arguments: '{"serviceId":"service-id"}',
        },
      ],
    });

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(String(request[1]?.body)) as {
      system: string;
      tools: { input_schema: unknown }[];
      messages: { role: string; content: unknown }[];
    };
    expect(body.system).toBe('Sos un asistente virtual.');
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
});
