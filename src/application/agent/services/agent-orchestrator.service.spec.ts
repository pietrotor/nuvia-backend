import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { LlmPort } from '@domain/agent/ports/llm.port';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { AgentTool } from '../tools/agent-tool';
import { AgentPromptComposer } from './agent-prompt.composer';
import { AgentToolRegistry } from './agent-tool.registry';
import { AgentOrchestrator } from './agent-orchestrator.service';

describe('AgentOrchestrator', () => {
  it('executes typed tools and returns the final assistant response', async () => {
    const llm: jest.Mocked<LlmPort> = {
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{ id: 'call-1', name: 'list_services', arguments: '{}' }],
        })
        .mockResolvedValueOnce({
          content: 'Tenemos limpieza facial a Bs 120.',
          toolCalls: [],
        }),
    };
    const tool: AgentTool = {
      definition: {
        name: 'list_services',
        description: 'Lista servicios',
        parameters: { type: 'object' },
      },
      execute: jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Un servicio.',
        data: [{ name: 'Limpieza facial', price: 'Bs 120' }],
      }),
    };
    const getConfig = {
      execute: jest.fn().mockResolvedValue({
        tenantId: 'tenant-id',
        agentName: 'Vale',
        tone: 'warm',
      } as BusinessConfig),
    } as unknown as GetBusinessConfigUseCase;
    const promptComposer = {
      compose: jest.fn().mockResolvedValue({
        staticText: 'Sos Vale, el asistente virtual del negocio.',
        volatileText: 'Fecha y hora de referencia: martes 4 de agosto, 15:00.',
        fingerprint: 'rev1.esthetics.abcd1234',
      }),
    } as unknown as AgentPromptComposer;
    const orchestrator = new AgentOrchestrator(
      llm,
      getConfig,
      new AgentToolRegistry([tool]),
      {
        findById: jest.fn().mockResolvedValue({
          timezone: 'America/La_Paz',
        }),
      } as never,
      { now: jest.fn().mockReturnValue(new Date('2026-08-02T13:00:00Z')) },
      promptComposer,
    );
    const history = [
      new Message({
        id: 'message-id',
        tenantId: 'tenant-id',
        conversationId: 'conversation-id',
        providerMessageId: 'provider-id',
        inReplyToProviderMessageId: null,
        direction: MessageDirection.INBOUND,
        kind: MessageKind.TEXT,
        content: '¿Qué servicios tienen?',
        occurredAt: new Date(),
      }),
    ];

    await expect(
      orchestrator.respond(history, {
        tenantId: 'tenant-id',
        conversationId: 'conversation-id',
        clientId: 'client-id',
        clientPhoneE164: '+59170000000',
      }),
    ).resolves.toEqual({
      text: 'Tenemos limpieza facial a Bs 120.',
      promptFingerprint: 'rev1.esthetics.abcd1234',
    });

    expect(tool.execute).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ clientId: 'client-id' }),
    );
    expect(llm.chat.mock.calls[0][0].messages[0]).toEqual(
      expect.objectContaining({ role: 'system', cacheable: true }),
    );
    expect(llm.chat.mock.calls[0][0].messages[1].content).toContain(
      'Fecha y hora',
    );
    expect(llm.chat.mock.calls[1][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          name: 'list_services',
          toolCallId: 'call-1',
        }),
      ]),
    );
  });
});
