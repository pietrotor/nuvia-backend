import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import {
  AgentTone,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { ConversationNotFoundError } from '@domain/conversations/exceptions/conversation.exceptions';
import { ConversationRepository } from '@domain/conversations/repositories/conversation.repository';
import { MessageRepository } from '@domain/conversations/repositories/message.repository';
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { ConversationHandoffLabelService } from '../services/conversation-handoff-label.service';
import { SendManualMessageUseCase } from './send-manual-message.use-case';

const now = new Date('2026-08-03T18:00:00.000Z');

const conversation = new Conversation({
  id: 'cv1',
  tenantId: 't1',
  clientId: 'c1',
  clientPhoneE164: '+59170000001',
  botPaused: false,
  botPausedAt: null,
  handoffReason: null,
  lastActivityAt: new Date('2026-08-03T15:00:00.000Z'),
});

describe('SendManualMessageUseCase', () => {
  let conversationRepository: jest.Mocked<
    Pick<ConversationRepository, 'findById' | 'recordManualReply'>
  >;
  let messageRepository: jest.Mocked<Pick<MessageRepository, 'recordIfNew'>>;
  let messaging: jest.Mocked<Pick<MessagingPort, 'sendText'>>;
  let handoffLabel: jest.Mocked<
    Pick<ConversationHandoffLabelService, 'markAttention' | 'clearAttention'>
  >;
  let useCase: SendManualMessageUseCase;

  beforeEach(() => {
    handoffLabel = {
      markAttention: jest.fn().mockResolvedValue(undefined),
      clearAttention: jest.fn().mockResolvedValue(undefined),
    };
    conversationRepository = {
      findById: jest.fn().mockResolvedValue(conversation),
      recordManualReply: jest.fn().mockResolvedValue(conversation),
    };
    messageRepository = {
      recordIfNew: jest.fn().mockResolvedValue(
        new Message({
          id: 'm1',
          tenantId: 't1',
          conversationId: 'cv1',
          providerMessageId: 'wamid.1',
          direction: MessageDirection.OUTBOUND,
          kind: MessageKind.TEXT,
          content: 'Ya te confirmo',
          inReplyToProviderMessageId: null,
          occurredAt: now,
        }),
      ),
    };
    messaging = {
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.1' }),
    };

    const businessConfigRepository: jest.Mocked<
      Pick<BusinessConfigRepository, 'findByTenant'>
    > = {
      findByTenant: jest.fn().mockResolvedValue(
        new BusinessConfig({
          id: 'bc1',
          tenantId: 't1',
          slug: 'estetica-glow',
          agentName: 'Vale',
          tone: AgentTone.WARM,
          currency: Currency.BOB,
          bookingPolicy: {
            minLeadTimeHours: 2,
            cancelRescheduleHours: 24,
            noShowMessage: 'Avisanos.',
          },
          faq: {},
        }),
      ),
    };
    const clock: ClockPort = { now: () => now };

    useCase = new SendManualMessageUseCase(
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
      businessConfigRepository as unknown as BusinessConfigRepository,
      messaging as unknown as MessagingPort,
      clock,
      { record: jest.fn() } as unknown as AuditRecorder,
      handoffLabel as unknown as ConversationHandoffLabelService,
    );
  });

  it("sends the text to the client's phone and stores it as outbound", async () => {
    const message = await useCase.execute('cv1', { text: 'Ya te confirmo' });

    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: '+59170000001',
        text: 'Ya te confirmo',
      }),
    );
    expect(message.direction).toBe(MessageDirection.OUTBOUND);
  });

  it('pauses the agent: from here on a human replies', async () => {
    await useCase.execute('cv1', { text: 'Ya te confirmo' });

    expect(conversationRepository.recordManualReply).toHaveBeenCalledWith(
      'cv1',
      now,
    );
  });

  it('sends nothing if the conversation does not belong to the tenant', async () => {
    conversationRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('cv1', { text: 'Hola' }),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
    expect(messaging.sendText).not.toHaveBeenCalled();
  });
});
