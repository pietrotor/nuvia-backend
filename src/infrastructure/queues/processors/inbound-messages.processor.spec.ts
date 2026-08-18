import { Job, Queue } from 'bullmq';

import { RecordInboundMessageUseCase } from '@application/agent/use-cases/record-inbound-message.use-case';
import { ReplyToConversationUseCase } from '@application/agent/use-cases/reply-to-conversation.use-case';
import { EnsureHumanAttentionLabelUseCase } from '@application/messaging/use-cases/ensure-human-attention-label.use-case';
import { SyncConversationLabelUseCase } from '@application/conversations/use-cases/sync-conversation-label.use-case';
import { EvolutionWebhookParser } from '@infrastructure/messaging/evolution-webhook.parser';
import {
  CONVERSATION_REPLY_JOB,
  INBOUND_MESSAGE_JOB,
} from '../queue.constants';
import {
  ConversationReplyJob,
  InboundMessageJob,
  InboundMessagesProcessor,
} from './inbound-messages.processor';

describe('InboundMessagesProcessor', () => {
  const buildProcessor = (queue: unknown) => {
    const parser = {
      parse: jest.fn().mockReturnValue({
        clientPhoneE164: '+59170000001',
        kind: 'text',
        content: 'hola',
      }),
    };
    const recordInboundMessage = {
      execute: jest.fn().mockResolvedValue({
        needsReply: true,
        conversationId: 'cv1',
        clientId: 'c1',
      }),
    };
    const replyToConversation = { execute: jest.fn() };
    const syncConversationLabel = { execute: jest.fn() };
    const ensureHumanAttentionLabel = { execute: jest.fn() };
    const tenantContext = {
      tenantId: null,
      userId: null,
      runWithTenant: jest.fn((_tenantId, fn) => fn()),
    };

    return new InboundMessagesProcessor(
      parser as unknown as EvolutionWebhookParser,
      recordInboundMessage as unknown as RecordInboundMessageUseCase,
      replyToConversation as unknown as ReplyToConversationUseCase,
      syncConversationLabel as unknown as SyncConversationLabelUseCase,
      ensureHumanAttentionLabel as unknown as EnsureHumanAttentionLabelUseCase,
      tenantContext,
      queue as Queue,
    );
  };

  const inboundJob = (providerMessageId: string) =>
    ({
      name: INBOUND_MESSAGE_JOB,
      id: 'job-1',
      data: { tenantId: 't1', providerMessageId, payload: {} },
    }) as Job<InboundMessageJob>;

  it('keeps a single delayed reply job per conversation across a burst', async () => {
    const existing = {
      getState: jest.fn().mockResolvedValue('delayed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(existing),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).process(inboundJob('wamid.2'));

    expect(existing.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      CONVERSATION_REPLY_JOB,
      expect.objectContaining<Partial<ConversationReplyJob>>({
        tenantId: 't1',
        conversationId: 'cv1',
        providerMessageId: 'wamid.2',
      }),
      expect.objectContaining({
        jobId: 't1-reply-cv1',
        delay: expect.any(Number),
      }),
    );
  });

  it('frees the id left behind by a finished reply so the next message queues', async () => {
    const finished = {
      getState: jest.fn().mockResolvedValue('completed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(finished),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).process(inboundJob('wamid.3'));

    expect(finished.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      CONVERSATION_REPLY_JOB,
      expect.objectContaining<Partial<ConversationReplyJob>>({
        providerMessageId: 'wamid.3',
      }),
      expect.objectContaining({ jobId: 't1-reply-cv1' }),
    );
  });

  it('queues under a distinct id while a reply is already running', async () => {
    const active = {
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn().mockRejectedValue(new Error('cannot remove active')),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(active),
      add: jest.fn().mockResolvedValue(undefined),
    };

    await buildProcessor(queue).process(inboundJob('wamid.4'));

    expect(active.remove).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      CONVERSATION_REPLY_JOB,
      expect.objectContaining<Partial<ConversationReplyJob>>({
        providerMessageId: 'wamid.4',
      }),
      expect.objectContaining({ jobId: 't1-reply-cv1-wamid.4' }),
    );
  });
});
