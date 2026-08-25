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
import { renderActionConfirmation } from '../messages/action-confirmation';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { AgentTool } from '../tools/agent-tool';
import { bookedAction, cancelledAction } from './agent-action.fixtures';
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

// Production incident 2026-08-24: the model answered "Listo, cancelamos…" after the
// client confirmed with "Se", without ever calling cancel_appointment.
const CANCEL_INCIDENT: [MessageDirection, string][] = [
  [MessageDirection.INBOUND, 'Quiero cancelar mi cita'],
  [
    MessageDirection.OUTBOUND,
    'Entendido, Pietro. Antes de cancelar tu masaje del miércoles 26 a las 17:00 con Valeria Mamani, ¿hay algún motivo en particular o simplemente no te viene bien ese horario?',
  ],
  [MessageDirection.INBOUND, 'No podré ir'],
  [
    MessageDirection.OUTBOUND,
    'Está bien. Entonces cancelamos tu cita del miércoles 26 a las 17:00.\n\n¿Confirmás que querés cancelarla?',
  ],
  [MessageDirection.INBOUND, 'Se'],
];

const CANCEL_HALLUCINATION =
  'Listo, cancelamos tu reserva del masaje del miércoles 26 a las 17:00.\n\nSi en otro momento te gustaría agendar un turno, acá estoy para ayudarte. ¿Hay algo más?';

const context = {
  tenantId: 'tenant-id',
  conversationId: 'conversation-id',
  clientId: 'client-id',
  clientPhoneE164: '+59169531998',
};

function historyFrom(transcript: [MessageDirection, string][]): Message[] {
  return transcript.map(
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
    {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      pruneOlderThan: jest.fn(),
    } as never,
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
    const handoff = tool(
      'request_handoff',
      jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Derivado.',
        committedAction: {
          operation: 'conversation.handoff',
          resourceType: 'conversation',
          resourceId: 'conversation-id',
          outcome: 'committed',
        },
      }),
    );

    const answer = await buildOrchestrator({ chat }, [book, handoff]).respond(
      historyFrom(INCIDENT_TRANSCRIPT),
      context,
      { providerMessageId: 'provider-id', text: 'Quiero confirmar' },
    );

    expect(detectOutboundClaims(answer.text)).toEqual([]);
    expect(answer.text).toBe(AgentOutboundCopy.unverifiedBooking);
    expect(answer.followUps).toEqual([]);
    expect(handoff.execute).toHaveBeenCalled();
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('lets the confirmation through once the booking is real', async () => {
    const action = bookedAction({
      facts: {
        ...bookedAction().facts,
        awaitsDeposit: true,
        serviceName: 'Hidrafacial',
        professionalName: 'Camila Rojas',
        dateLabel: 'lunes',
        startsAtLabel: '16:45',
      },
    });
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
        committedAction: action,
        followUp: { kind: 'deposit_qr', appointmentId: 'ap1' },
      }),
    );

    const answer = await buildOrchestrator({ chat }, [book]).respond(
      historyFrom(INCIDENT_TRANSCRIPT),
      context,
      { providerMessageId: 'provider-id', text: 'Quiero confirmar' },
    );

    expect(detectOutboundClaims(answer.text)).toContain(OutboundClaim.BOOKING);
    expect(book.execute).toHaveBeenCalled();
    expect(answer.text).toBe(
      renderActionConfirmation(action, { depositQrQueued: true }),
    );
    expect(answer.followUps).toEqual([
      { kind: 'deposit_qr', appointmentId: 'ap1' },
    ]);
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('never tells the client a cancellation happened when cancel_appointment did not run', async () => {
    const chat = jest
      .fn<Promise<LlmChatResult>, [LlmChatInput]>()
      .mockResolvedValueOnce({ content: CANCEL_HALLUCINATION, toolCalls: [] })
      .mockResolvedValueOnce({ content: CANCEL_HALLUCINATION, toolCalls: [] });
    const cancel = tool('cancel_appointment');
    const handoff = tool(
      'request_handoff',
      jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Derivado.',
        committedAction: {
          operation: 'conversation.handoff',
          resourceType: 'conversation',
          resourceId: 'conversation-id',
          outcome: 'committed',
        },
      }),
    );

    const answer = await buildOrchestrator({ chat }, [cancel, handoff]).respond(
      historyFrom(CANCEL_INCIDENT),
      context,
      { providerMessageId: 'provider-id', text: 'Se' },
    );

    expect(cancel.execute).not.toHaveBeenCalled();
    expect(detectOutboundClaims(answer.text)).toEqual([]);
    expect(answer.text).toBe(AgentOutboundCopy.unverifiedCancellation);
    expect(handoff.execute).toHaveBeenCalled();
  });

  it('confirms a real cancellation from the receipt after the tool commits', async () => {
    const action = cancelledAction();
    const chat = jest
      .fn<Promise<LlmChatResult>, [LlmChatInput]>()
      .mockResolvedValueOnce({ content: CANCEL_HALLUCINATION, toolCalls: [] })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'call-1',
            name: 'cancel_appointment',
            arguments: JSON.stringify({
              appointmentId: 'ap1',
              confirmedByClient: true,
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: 'Inventé que cancelé otra cosa.',
        toolCalls: [],
      });
    const cancel = tool(
      'cancel_appointment',
      jest.fn().mockResolvedValue({
        status: 'success',
        summary: 'Cita cancelada.',
        committedAction: action,
      }),
    );

    const answer = await buildOrchestrator({ chat }, [cancel]).respond(
      historyFrom(CANCEL_INCIDENT),
      context,
      { providerMessageId: 'provider-id', text: 'Se' },
    );

    expect(cancel.execute).toHaveBeenCalled();
    expect(answer.text).toBe(renderActionConfirmation(action));
    expect(answer.text).toContain('quedó cancelada');
    expect(answer.text).not.toContain('Inventé');
  });
});
