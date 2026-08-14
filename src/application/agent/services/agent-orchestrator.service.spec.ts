import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { LlmPort } from '@domain/agent/ports/llm.port';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { AgentTool } from '../tools/agent-tool';
import { AgentPromptComposer } from './agent-prompt.composer';
import { AgentToolRegistry } from './agent-tool.registry';
import { AgentOrchestrator } from './agent-orchestrator.service';

const context = {
  tenantId: 'tenant-id',
  conversationId: 'conversation-id',
  clientId: 'client-id',
  clientPhoneE164: '+59170000000',
};

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

function buildOrchestrator(
  llm: LlmPort,
  ...tools: AgentTool[]
): AgentOrchestrator {
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

  return new AgentOrchestrator(
    llm,
    getConfig,
    new AgentToolRegistry(tools),
    {
      findById: jest.fn().mockResolvedValue({
        timezone: 'America/La_Paz',
      }),
    } as never,
    {
      findById: jest.fn().mockResolvedValue({ branchId: null }),
      setBranch: jest.fn(),
    } as never,
    {
      findActive: jest.fn().mockResolvedValue([{ id: 'branch-1' }]),
    } as never,
    {
      execute: jest.fn().mockResolvedValue([]),
    } as never,
    { now: jest.fn().mockReturnValue(new Date('2026-08-02T13:00:00Z')) },
    promptComposer,
    { error: jest.fn(), warn: jest.fn() },
  );
}

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
    const orchestrator = buildOrchestrator(llm, tool);

    await expect(orchestrator.respond(history, context)).resolves.toEqual({
      text: 'Tenemos limpieza facial a Bs 120.',
      promptFingerprint: 'rev1.esthetics.abcd1234',
      followUps: [],
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

  it('carries the follow-up a tool asked for without showing it to the model', async () => {
    const llm: jest.Mocked<LlmPort> = {
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: 'call-1', name: 'book_appointment', arguments: '{}' },
          ],
        })
        .mockResolvedValueOnce({
          content: 'Listo, te agendé.',
          toolCalls: [],
        }),
    };
    const tool: AgentTool = {
      definition: {
        name: 'book_appointment',
        description: 'Agenda un turno',
        parameters: { type: 'object' },
      },
      execute: jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Turno reservado, pendiente de seña.',
        followUp: { kind: 'deposit_qr', appointmentId: 'ap1' },
      }),
    };

    const answer = await buildOrchestrator(llm, tool).respond(history, context);

    expect(answer.followUps).toEqual([
      { kind: 'deposit_qr', appointmentId: 'ap1' },
    ]);
    const toolMessage = llm.chat.mock.calls[1][0].messages.find(
      (message) => message.role === 'tool',
    );
    expect(toolMessage?.content).not.toContain('followUp');
  });

  describe('when the answer claims something no tool did', () => {
    const claim = 'Listo, te agendo el turno. En un momento te llega el QR.';

    function stubTool(name: string, result: object): AgentTool {
      return {
        definition: { name, description: name, parameters: { type: 'object' } },
        execute: jest.fn().mockResolvedValue({
          status: 'success',
          summary: name,
          ...result,
        }),
      };
    }

    it('forces a tool round instead of sending the claim to the client', async () => {
      const llm: jest.Mocked<LlmPort> = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({ content: claim, toolCalls: [] })
          .mockResolvedValueOnce({
            content: null,
            toolCalls: [
              { id: 'call-1', name: 'book_appointment', arguments: '{}' },
            ],
          })
          .mockResolvedValueOnce({
            content: 'Listo, te agendo el turno.',
            toolCalls: [],
          }),
      };
      const book = stubTool('book_appointment', {
        followUp: { kind: 'deposit_qr', appointmentId: 'ap1' },
      });
      const handoff = stubTool('request_handoff', {});

      const answer = await buildOrchestrator(llm, book, handoff).respond(
        history,
        context,
      );

      expect(llm.chat.mock.calls[0][0].toolChoice).toBe('auto');
      expect(llm.chat.mock.calls[1][0].toolChoice).toBe('any');
      expect(book.execute).toHaveBeenCalled();
      expect(handoff.execute).not.toHaveBeenCalled();
      expect(answer.text).toBe('Listo, te agendo el turno.');
      expect(answer.followUps).toEqual([
        { kind: 'deposit_qr', appointmentId: 'ap1' },
      ]);
    });

    it('hands off rather than repeat the claim when the retry books nothing', async () => {
      const llm: jest.Mocked<LlmPort> = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({ content: claim, toolCalls: [] })
          .mockResolvedValueOnce({ content: claim, toolCalls: [] }),
      };
      const book = stubTool('book_appointment', {});
      const handoff = stubTool('request_handoff', {});

      const answer = await buildOrchestrator(llm, book, handoff).respond(
        history,
        context,
      );

      expect(book.execute).not.toHaveBeenCalled();
      expect(handoff.execute).toHaveBeenCalledWith(
        { reason: 'unverified_booking_deposit_qr' },
        expect.objectContaining({ conversationId: 'conversation-id' }),
      );
      expect(answer.text).toBe(AgentOutboundCopy.unverifiedBooking);
    });

    it('leaves an answer alone when the booking queued the QR', async () => {
      const llm: jest.Mocked<LlmPort> = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({
            content: null,
            toolCalls: [
              { id: 'call-1', name: 'book_appointment', arguments: '{}' },
            ],
          })
          .mockResolvedValueOnce({ content: claim, toolCalls: [] }),
      };
      const book = stubTool('book_appointment', {
        followUp: { kind: 'deposit_qr', appointmentId: 'ap1' },
      });

      const answer = await buildOrchestrator(llm, book).respond(
        history,
        context,
      );

      expect(llm.chat).toHaveBeenCalledTimes(2);
      expect(answer.text).toBe(claim);
    });

    // A service that charges no deposit books fine and queues no image, so announcing
    // a QR is a promise nothing will keep.
    it('still questions the QR when the booking queued none', async () => {
      const llm: jest.Mocked<LlmPort> = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({
            content: null,
            toolCalls: [
              { id: 'call-1', name: 'book_appointment', arguments: '{}' },
            ],
          })
          .mockResolvedValueOnce({ content: claim, toolCalls: [] })
          .mockResolvedValueOnce({
            content: 'Listo, te agendé. Este servicio no lleva seña.',
            toolCalls: [],
          }),
      };
      const book = stubTool('book_appointment', {});
      const handoff = stubTool('request_handoff', {});

      const answer = await buildOrchestrator(llm, book, handoff).respond(
        history,
        context,
      );

      expect(llm.chat).toHaveBeenCalledTimes(3);
      expect(llm.chat.mock.calls[2][0].toolChoice).toBe('any');
      expect(handoff.execute).not.toHaveBeenCalled();
      expect(answer.text).toBe(
        'Listo, te agendé. Este servicio no lleva seña.',
      );
      expect(answer.followUps).toEqual([]);
    });

    it('hands off when it insists on a QR that was never queued', async () => {
      const llm: jest.Mocked<LlmPort> = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({
            content: null,
            toolCalls: [
              { id: 'call-1', name: 'book_appointment', arguments: '{}' },
            ],
          })
          .mockResolvedValueOnce({ content: claim, toolCalls: [] })
          .mockResolvedValueOnce({ content: claim, toolCalls: [] }),
      };
      const book = stubTool('book_appointment', {});
      const handoff = stubTool('request_handoff', {});

      const answer = await buildOrchestrator(llm, book, handoff).respond(
        history,
        context,
      );

      expect(handoff.execute).toHaveBeenCalledWith(
        { reason: 'unverified_deposit_qr' },
        expect.objectContaining({ conversationId: 'conversation-id' }),
      );
      expect(answer.text).toBe(AgentOutboundCopy.unverifiedDepositQr);
    });
  });

  // A client asked what else was free that day and got every quarter of an hour until
  // closing, including starts too late for the treatment to finish.
  describe('when the answer offers hours the agenda never returned', () => {
    const invented = [
      'Los horarios disponibles son:',
      '- 09:00',
      '- 09:15',
      '- 09:30',
      '- 17:45',
    ].join('\n');
    const honest = 'Hoy tengo 09:00, 12:00 o 17:00. ¿Cuál te sirve?';

    function availability(): AgentTool {
      return {
        definition: {
          name: 'find_availability',
          description: 'find_availability',
          parameters: { type: 'object' },
        },
        execute: jest.fn().mockResolvedValue({
          status: 'success',
          summary: 'Tres horarios.',
          offerableTimes: ['09:00', '12:00', '17:00', '09:00 a 18:00'],
        }),
      };
    }

    function llmAnswering(...answers: string[]): jest.Mocked<LlmPort> {
      const chat = jest.fn().mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'call-1', name: 'find_availability', arguments: '{}' },
        ],
      });
      for (const content of answers)
        chat.mockResolvedValueOnce({
          content,
          toolCalls: [],
        });

      return { chat };
    }

    it('asks for a rewrite listing only the times the tool gave back', async () => {
      const llm = llmAnswering(invented, honest);

      const answer = await buildOrchestrator(llm, availability()).respond(
        history,
        context,
      );

      expect(answer.text).toBe(honest);
      const correction = llm.chat.mock.calls[2][0].messages.at(-1);
      expect(correction).toEqual(expect.objectContaining({ role: 'user' }));
      expect(correction?.content).toContain('09:00, 12:00, 17:00, 18:00');
    });

    it('leaves alone an answer that sticks to those times', async () => {
      const llm = llmAnswering(honest);

      const answer = await buildOrchestrator(llm, availability()).respond(
        history,
        context,
      );

      expect(answer.text).toBe(honest);
      expect(llm.chat).toHaveBeenCalledTimes(2);
    });

    it('hands off rather than send a schedule it keeps making up', async () => {
      const llm = llmAnswering(invented, invented);
      const handoff: AgentTool = {
        definition: {
          name: 'request_handoff',
          description: 'request_handoff',
          parameters: { type: 'object' },
        },
        execute: jest
          .fn()
          .mockResolvedValue({ status: 'success', summary: 'Derivado.' }),
      };

      const answer = await buildOrchestrator(
        llm,
        availability(),
        handoff,
      ).respond(history, context);

      expect(handoff.execute).toHaveBeenCalledWith(
        { reason: 'invented_schedule' },
        expect.objectContaining({ conversationId: 'conversation-id' }),
      );
      expect(answer.text).toBe(AgentOutboundCopy.unverifiedSchedule);
    });
  });
});
