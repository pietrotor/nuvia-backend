import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { GetConversationTraceThreadUseCase } from './get-conversation-trace-thread.use-case';

const message = (input: {
  id: string;
  providerMessageId: string;
  inReplyToProviderMessageId?: string | null;
  content: string | null;
  kind?: MessageKind;
}) =>
  new Message({
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    direction: MessageDirection.INBOUND,
    occurredAt: new Date('2026-08-21T16:00:00.000Z'),
    kind: input.kind ?? MessageKind.TEXT,
    inReplyToProviderMessageId: null,
    ...input,
  });

describe('GetConversationTraceThreadUseCase', () => {
  it('hydrates quoted previews that fall outside the thread window', async () => {
    const reply = message({
      id: 'reply',
      providerMessageId: 'reply-provider',
      inReplyToProviderMessageId: 'old-qr',
      content: 'Ese es el comprobante.',
    });
    const quotedQr = message({
      id: 'qr',
      providerMessageId: 'old-qr',
      content: 'QR para la cita del viernes',
      kind: MessageKind.IMAGE,
    });
    const messages = {
      findByConversation: jest.fn().mockResolvedValue([reply]),
      findByProviderMessageIds: jest.fn().mockResolvedValue([quotedQr]),
    };
    const useCase = new GetConversationTraceThreadUseCase(
      {
        findById: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
      } as never,
      messages as never,
      { listByConversation: jest.fn().mockResolvedValue([]) } as never,
      {
        runWithTenant: jest.fn(
          (_tenantId: string, callback: () => Promise<unknown>) => callback(),
        ),
      } as never,
      { record: jest.fn() } as never,
    );

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
    });

    expect(messages.findByProviderMessageIds).toHaveBeenCalledWith(['old-qr']);
    expect(result.quotedMessagesByProviderId.get('old-qr')).toBe(quotedQr);
  });
});
