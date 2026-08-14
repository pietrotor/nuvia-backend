import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import {
  LlmChatInput,
  LlmChatResult,
  LlmPort,
} from '@domain/agent/ports/llm.port';
import {
  detectOutboundClaims,
  OutboundClaim,
} from '@domain/agent/services/outbound-claim';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { AgentTool } from '../tools/agent-tool';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { AgentPromptComposer } from './agent-prompt.composer';
import { AgentToolRegistry } from './agent-tool.registry';

// Replays the conversation that shipped a booking to a client while the agenda stayed
// empty. On 8 August 2026 the agent offered 17:00, 18:00 and 19:00 on a Sunday to a
// professional who does not work Sundays and closes at 18:00, then said "listo, te agendo"
// and promised a deposit QR. No appointment row and no audit entry were ever written.
const INCIDENT_TRANSCRIPT: [MessageDirection, string][] = [
  [MessageDirection.INBOUND, 'Hidratados quiero reservar para mañana'],
  [MessageDirection.OUTBOUND, '¿Con qué profesional preferís?'],
  [MessageDirection.INBOUND, 'Ya con camila'],
  [MessageDirection.OUTBOUND, '¿A qué hora te vendría bien?'],
  [MessageDirection.INBOUND, 'Final de la tarde'],
  [MessageDirection.INBOUND, 'A las 7'],
  [MessageDirection.INBOUND, 'Si quiero confirmar'],
];

const HALLUCINATED_ANSWER =
  'Listo, te agendo Hidrafacial con Camila Rojas mañana domingo 9 de agosto a las 19:00.\n\nEn un momento te llega el QR con el monto de la seña.';

const context = {
  tenantId: 'tenant-id',
  conversationId: 'conversation-id',
  clientId: 'client-id',
  clientPhoneE164: '+59169531998',
};

function history(): Message[] {
  return INCIDENT_TRANSCRIPT.map(
    ([direction, content], index) =>
      new Message({
        id: `message-${index}`,
        tenantId: 'tenant-id',
        conversationId: 'conversation-id',
        providerMessageId: `provider-${index}`,
        inReplyToProviderMessageId: null,
        direction,
        kind: MessageKind.TEXT,
        content,
        occurredAt: new Date('2026-08-08T14:05:00.000Z'),
      }),
  );
}

function tool(
  name: string,
  execute: AgentTool['execute'] = jest.fn().mockResolvedValue({
    status: 'success',
    summary: name,
  }),
): AgentTool {
  return {
    definition: { name, description: name, parameters: { type: 'object' } },
    execute,
  };
}

function buildOrchestrator(
  llm: LlmPort,
  tools: AgentTool[],
): AgentOrchestrator {
  const getConfig = {
    execute: jest.fn().mockResolvedValue({
      tenantId: 'tenant-id',
      agentName: 'Vale',
    } as BusinessConfig),
  } as unknown as GetBusinessConfigUseCase;
  const promptComposer = {
    compose: jest.fn().mockResolvedValue({
      staticText: 'Reglas de plataforma.',
      volatileText:
        'Estado real de esta clienta en la agenda, ahora mismo: no tiene ninguna reserva registrada',
      fingerprint: 'rev1.esthetics.abcd1234',
    }),
  } as unknown as AgentPromptComposer;

  return new AgentOrchestrator(
    llm,
    getConfig,
    new AgentToolRegistry(tools),
    {
      findById: jest.fn().mockResolvedValue({ timezone: 'America/La_Paz' }),
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
    { now: jest.fn().mockReturnValue(new Date('2026-08-08T14:05:00.000Z')) },
    promptComposer,
    { error: jest.fn(), warn: jest.fn() },
  );
}

describe('agent hallucination eval', () => {
  it('never tells the client a booking happened when the agenda stayed empty', async () => {
    // The model behaves exactly as it did during the incident: it announces the booking,
    // and when forced to act it insists on a Sunday slot the schedule rejects.
    const chat = jest
      .fn<Promise<LlmChatResult>, [LlmChatInput]>()
      .mockResolvedValueOnce({ content: HALLUCINATED_ANSWER, toolCalls: [] })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'call-1',
            name: 'book_appointment',
            arguments: JSON.stringify({
              serviceId: 'hidrafacial',
              professionalId: 'camila',
              startsAt: '2026-08-09T23:00:00.000Z',
              confirmedByClient: true,
            }),
          },
        ],
      })
      .mockResolvedValueOnce({ content: HALLUCINATED_ANSWER, toolCalls: [] });
    const book = tool(
      'book_appointment',
      jest.fn().mockRejectedValue(new SlotUnavailableError()),
    );
    const handoff = tool('request_handoff');

    const answer = await buildOrchestrator({ chat }, [book, handoff]).respond(
      history(),
      context,
    );

    expect(detectOutboundClaims(answer.text)).toEqual([]);
    expect(answer.text).toBe(AgentOutboundCopy.unverifiedBooking);
    expect(answer.followUps).toEqual([]);
    expect(handoff.execute).toHaveBeenCalled();
  });

  it('lets the confirmation through once the booking is real', async () => {
    const chat = jest
      .fn<Promise<LlmChatResult>, [LlmChatInput]>()
      .mockResolvedValueOnce({ content: HALLUCINATED_ANSWER, toolCalls: [] })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'call-1', name: 'book_appointment', arguments: '{}' },
        ],
      })
      .mockResolvedValueOnce({
        content:
          'Listo, te agendo Hidrafacial con Camila Rojas el lunes a las 16:45.',
        toolCalls: [],
      });
    const book = tool(
      'book_appointment',
      jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Turno reservado, pendiente de seña.',
        followUp: { kind: 'deposit_qr', appointmentId: 'ap1' },
      }),
    );

    const answer = await buildOrchestrator({ chat }, [book]).respond(
      history(),
      context,
    );

    expect(detectOutboundClaims(answer.text)).toContain(OutboundClaim.BOOKING);
    expect(book.execute).toHaveBeenCalled();
    expect(answer.followUps).toEqual([
      { kind: 'deposit_qr', appointmentId: 'ap1' },
    ]);
  });
});
