import { Job, Queue } from 'bullmq';

import { RecordInboundMessageUseCase } from '@application/agent/use-cases/record-inbound-message.use-case';
import { ReplyToConversationUseCase } from '@application/agent/use-cases/reply-to-conversation.use-case';
import { HandleNotificationCommandUseCase } from '@application/appointment-notifications/use-cases/handle-notification-command.use-case';
import { EnsureHumanAttentionLabelUseCase } from '@application/messaging/use-cases/ensure-human-attention-label.use-case';
import { SyncConversationLabelUseCase } from '@application/conversations/use-cases/sync-conversation-label.use-case';
import { CaptureInboundDepositReceiptUseCase } from '@application/deposits/use-cases/capture-inbound-deposit-receipt.use-case';
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
    const handleNotificationCommand = {
      execute: jest.fn().mockResolvedValue(false),
    };
    const syncConversationLabel = { execute: jest.fn() };
    const ensureHumanAttentionLabel = { execute: jest.fn() };
    const captureDepositReceipt = {
      execute: jest.fn().mockResolvedValue('not_expected'),
    };
    const tenantContext = {
      tenantId: null,
      userId: null,
      runWithTenant: jest.fn((_tenantId, fn) => fn()),
    };

    return {
      processor: new InboundMessagesProcessor(
        parser as unknown as EvolutionWebhookParser,
        recordInboundMessage as unknown as RecordInboundMessageUseCase,
        replyToConversation as unknown as ReplyToConversationUseCase,
        handleNotificationCommand as unknown as HandleNotificationCommandUseCase,
        syncConversationLabel as unknown as SyncConversationLabelUseCase,
        ensureHumanAttentionLabel as unknown as EnsureHumanAttentionLabelUseCase,
        captureDepositReceipt as unknown as CaptureInboundDepositReceiptUseCase,
        tenantContext,
        queue as Queue,
      ),
      recordInboundMessage,
      handleNotificationCommand,
      parser,
      captureDepositReceipt,
    };
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

    await buildProcessor(queue).processor.process(inboundJob('wamid.2'));

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

    await buildProcessor(queue).processor.process(inboundJob('wamid.3'));

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

    await buildProcessor(queue).processor.process(inboundJob('wamid.4'));

    expect(active.remove).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      CONVERSATION_REPLY_JOB,
      expect.objectContaining<Partial<ConversationReplyJob>>({
        providerMessageId: 'wamid.4',
      }),
      expect.objectContaining({ jobId: 't1-reply-cv1-wamid.4' }),
    );
  });

  it('handles activation commands before recording a client conversation', async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
    };
    const built = buildProcessor(queue);
    built.parser.parse.mockReturnValue({
      clientPhoneE164: '+59170000001',
      kind: 'text',
      content: 'ACTIVAR AB12CD',
    });
    built.handleNotificationCommand.execute.mockResolvedValue(true);

    await built.processor.process(inboundJob('wamid.activate'));

    expect(built.handleNotificationCommand.execute).toHaveBeenCalled();
    expect(built.recordInboundMessage.execute).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('handles STOP before the agent when the contact exists', async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
    };
    const built = buildProcessor(queue);
    built.parser.parse.mockReturnValue({
      clientPhoneE164: '+59170000001',
      kind: 'text',
      content: 'STOP',
    });
    built.handleNotificationCommand.execute.mockResolvedValue(true);

    await built.processor.process(inboundJob('wamid.stop'));

    expect(built.handleNotificationCommand.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneE164: '+59170000001',
        command: expect.objectContaining({ kind: 'opt_out' }),
      }),
    );
    expect(built.recordInboundMessage.execute).not.toHaveBeenCalled();
  });

  it('keeps a pending text turn when a receipt follows in the same burst', async () => {
    const delayedReply = {
      getState: jest.fn().mockResolvedValue('delayed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(delayedReply),
      add: jest.fn(),
    };
    const built = buildProcessor(queue);
    built.parser.parse.mockReturnValue({
      clientPhoneE164: '+59170000001',
      kind: 'image',
      content: null,
      occurredAt: new Date('2026-08-21T12:00:00.000Z'),
    });
    built.captureDepositReceipt.execute.mockResolvedValue('attached');

    await built.processor.process(inboundJob('wamid.receipt'));

    expect(built.captureDepositReceipt.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMessageId: 'wamid.receipt',
        deferAmbiguousReply: true,
      }),
    );
    expect(delayedReply.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'reply',
      expect.objectContaining({ providerMessageId: 'wamid.receipt' }),
      expect.any(Object),
    );
  });
});
