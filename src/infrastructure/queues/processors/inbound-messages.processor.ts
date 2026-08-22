import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { RecordInboundMessageUseCase } from '@application/agent/use-cases/record-inbound-message.use-case';
import { ReplyToConversationUseCase } from '@application/agent/use-cases/reply-to-conversation.use-case';
import { HandleNotificationCommandUseCase } from '@application/appointment-notifications/use-cases/handle-notification-command.use-case';
import { EnsureHumanAttentionLabelUseCase } from '@application/messaging/use-cases/ensure-human-attention-label.use-case';
import { SyncConversationLabelUseCase } from '@application/conversations/use-cases/sync-conversation-label.use-case';
import { CaptureInboundDepositReceiptUseCase } from '@application/deposits/use-cases/capture-inbound-deposit-receipt.use-case';
import { parseNotificationCommand } from '@domain/appointment-notifications/value-objects/notification-command.vo';
import { MessageKind } from '@domain/conversations/entities/message.entity';
import { replyDebounceMs } from '@domain/messaging/services/human-pacing';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { EvolutionWebhookParser } from '@infrastructure/messaging/evolution-webhook.parser';
import {
  CONVERSATION_REPLY_JOB,
  INBOUND_MESSAGE_JOB,
  INBOUND_MESSAGES_QUEUE,
  LABEL_ASSOCIATION_JOB,
  LABEL_ENSURE_JOB,
} from '../queue.constants';

export interface InboundMessageJob {
  tenantId: string;
  providerMessageId: string;
  payload: unknown;
}

export interface ConversationReplyJob {
  tenantId: string;
  conversationId: string;
  clientId: string;
  clientPhoneE164: string;
  providerMessageId: string;
}

export interface LabelAssociationJob {
  tenantId: string;
  chatJid: string;
  labelId: string;
  action: 'add' | 'remove';
}

export interface LabelEnsureJob {
  tenantId: string;
}

type InboundQueueJob =
  | InboundMessageJob
  | ConversationReplyJob
  | LabelAssociationJob
  | LabelEnsureJob;

// A reply spends most of its time waiting: the debounce, the agent thinking and
// the typing indicator. Serialising those would stall every other tenant.
const CONCURRENCY = 10;

@Processor(INBOUND_MESSAGES_QUEUE, { concurrency: CONCURRENCY })
export class InboundMessagesProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundMessagesProcessor.name);

  constructor(
    private readonly parser: EvolutionWebhookParser,
    private readonly recordInboundMessage: RecordInboundMessageUseCase,
    private readonly replyToConversation: ReplyToConversationUseCase,
    private readonly handleNotificationCommand: HandleNotificationCommandUseCase,
    private readonly syncConversationLabel: SyncConversationLabelUseCase,
    private readonly ensureHumanAttentionLabel: EnsureHumanAttentionLabelUseCase,
    private readonly captureDepositReceipt: CaptureInboundDepositReceiptUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @InjectQueue(INBOUND_MESSAGES_QUEUE)
    private readonly queue: Queue<InboundQueueJob>,
  ) {
    super();
  }

  async process(job: Job<InboundQueueJob>): Promise<void> {
    switch (job.name) {
      case INBOUND_MESSAGE_JOB:
        return this.record(job as Job<InboundMessageJob>);
      case CONVERSATION_REPLY_JOB:
        return this.reply(job as Job<ConversationReplyJob>);
      case LABEL_ASSOCIATION_JOB:
        return this.syncLabel(job as Job<LabelAssociationJob>);
      case LABEL_ENSURE_JOB:
        return this.ensureLabel(job as Job<LabelEnsureJob>);
      default:
        this.logger.warn(`Ignored unknown job ${job.name}`);
    }
  }

  private async reply(job: Job<ConversationReplyJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.replyToConversation.execute(job.data),
    );
  }

  private async syncLabel(job: Job<LabelAssociationJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.syncConversationLabel.execute({
        chatJid: job.data.chatJid,
        labelId: job.data.labelId,
        action: job.data.action,
      }),
    );
  }

  private async ensureLabel(job: Job<LabelEnsureJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.ensureHumanAttentionLabel.execute(),
    );
  }

  private async record(job: Job<InboundMessageJob>): Promise<void> {
    const message = this.parser.parse(job.data.payload);
    if (!message) {
      this.logger.debug(`Ignored unsupported inbound job ${job.id}`);
      return;
    }

    const { tenantId, providerMessageId } = job.data;
    const command = parseNotificationCommand(message.content);
    if (command) {
      const handled = await this.tenantContext.runWithTenant(tenantId, () =>
        this.handleNotificationCommand.execute({
          tenantId,
          phoneE164: message.clientPhoneE164,
          providerMessageId,
          command,
        }),
      );
      if (handled) return;
    }

    const recorded = await this.tenantContext.runWithTenant(tenantId, () =>
      this.recordInboundMessage.execute({
        ...message,
        providerMessageId,
        allowRecovery: job.attemptsMade > 0,
      }),
    );
    if (!recorded.needsReply) return;

    if (message.kind === MessageKind.IMAGE) {
      const replyJobId = `${tenantId}-reply-${recorded.conversationId}`;
      const existingReply = await this.queue.getJob(replyJobId);
      const existingReplyState = existingReply
        ? await existingReply.getState()
        : undefined;
      const shouldContinueAgent =
        existingReplyState === 'active' ||
        existingReplyState === 'delayed' ||
        existingReplyState === 'waiting' ||
        Boolean(message.content?.trim());
      const outcome = await this.tenantContext.runWithTenant(tenantId, () =>
        this.captureDepositReceipt.execute({
          tenantId,
          clientId: recorded.clientId,
          conversationId: recorded.conversationId,
          clientPhoneE164: message.clientPhoneE164,
          providerMessageId,
          inReplyToProviderMessageId: message.inReplyToProviderMessageId,
          deferAmbiguousReply: shouldContinueAgent,
          occurredAt: message.occurredAt,
        }),
      );
      if (outcome !== 'not_expected') {
        if (shouldContinueAgent) {
          await this.replaceDelayedReply(replyJobId, {
            tenantId,
            conversationId: recorded.conversationId,
            clientId: recorded.clientId,
            clientPhoneE164: message.clientPhoneE164,
            providerMessageId,
          });
        }
        return;
      }
    }

    // One delayed reply per conversation: later messages in a burst replace the
    // pending job so the LLM runs once against the full history.
    const replyJobId = `${tenantId}-reply-${recorded.conversationId}`;
    await this.replaceDelayedReply(replyJobId, {
      tenantId,
      conversationId: recorded.conversationId,
      clientId: recorded.clientId,
      clientPhoneE164: message.clientPhoneE164,
      providerMessageId,
    });
  }

  private async replaceDelayedReply(
    jobId: string,
    data: ConversationReplyJob,
  ): Promise<void> {
    const existing = await this.queue.getJob(jobId);
    const state = existing ? await existing.getState() : undefined;

    // A running reply can't be removed and won't see this message, so the new
    // one queues under its own id instead of being dropped as a duplicate.
    if (state === 'active') {
      await this.enqueueReply(`${jobId}-${data.providerMessageId}`, data);
      return;
    }

    // Pending jobs are superseded by this one; finished jobs only linger in the
    // completed/failed sets, where BullMQ would still reject the id as taken.
    if (existing) {
      await existing.remove().catch(() => undefined);
    }

    await this.enqueueReply(jobId, data);
  }

  private async enqueueReply(
    jobId: string,
    data: ConversationReplyJob,
  ): Promise<void> {
    await this.queue.add(CONVERSATION_REPLY_JOB, data, {
      jobId,
      delay: replyDebounceMs(),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
