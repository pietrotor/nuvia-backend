import { Client } from '@domain/clients/entities/client.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { ConversationRepository } from '@domain/conversations/repositories/conversation.repository';
import { MessageRepository } from '@domain/conversations/repositories/message.repository';
import { RecordInboundMessageUseCase } from './record-inbound-message.use-case';

const now = new Date('2026-08-04T15:00:00.000Z');

describe('RecordInboundMessageUseCase', () => {
  let clients: jest.Mocked<Pick<ClientRepository, 'findOrCreate'>>;
  let conversations: jest.Mocked<Pick<ConversationRepository, 'findOrCreate'>>;
  let messages: jest.Mocked<
    Pick<MessageRepository, 'recordIfNew' | 'hasReplyTo'>
  >;
  let useCase: RecordInboundMessageUseCase;

  beforeEach(() => {
    clients = {
      findOrCreate: jest.fn().mockResolvedValue(
        new Client({
          id: 'c1',
          tenantId: 't1',
          name: 'Ana',
          phoneE164: '+59170000001',
          notes: null,
        }),
      ),
    };
    conversations = {
      findOrCreate: jest.fn().mockResolvedValue(
        new Conversation({
          id: 'cv1',
          tenantId: 't1',
          clientId: 'c1',
          clientPhoneE164: '+59170000001',
          botPaused: false,
          botPausedAt: null,
          handoffReason: null,
          lastActivityAt: now,
        }),
      ),
    };
    messages = {
      recordIfNew: jest.fn().mockResolvedValue(
        new Message({
          id: 'm-in',
          tenantId: 't1',
          conversationId: 'cv1',
          providerMessageId: 'wamid.in',
          direction: MessageDirection.INBOUND,
          kind: MessageKind.TEXT,
          content: 'Hola',
          inReplyToProviderMessageId: null,
          occurredAt: now,
        }),
      ),
      hasReplyTo: jest.fn().mockResolvedValue(false),
    };

    useCase = new RecordInboundMessageUseCase(
      clients as unknown as ClientRepository,
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
    );
  });

  const input = {
    providerMessageId: 'wamid.in',
    clientPhoneE164: '+59170000001',
    clientName: 'Ana',
    kind: MessageKind.TEXT,
    content: 'Hola',
    occurredAt: now,
  };

  it('stores the message and asks for a reply', async () => {
    await expect(useCase.execute(input)).resolves.toEqual({
      clientId: 'c1',
      conversationId: 'cv1',
      needsReply: true,
    });
    expect(messages.recordIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'cv1',
        providerMessageId: 'wamid.in',
        direction: MessageDirection.INBOUND,
      }),
    );
  });

  it('still asks for a reply when the webhook repeats a message nobody answered', async () => {
    messages.recordIfNew.mockResolvedValue(null);

    await expect(useCase.execute(input)).resolves.toEqual(
      expect.objectContaining({ needsReply: true }),
    );
  });

  it('does not queue a second reply for a message already answered', async () => {
    messages.recordIfNew.mockResolvedValue(null);
    messages.hasReplyTo.mockResolvedValue(true);

    await expect(useCase.execute(input)).resolves.toEqual(
      expect.objectContaining({ needsReply: false }),
    );
  });
});
