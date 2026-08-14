import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { RecordInboundMessageUseCase } from '@application/agent/use-cases/record-inbound-message.use-case';
import { ReplyToConversationUseCase } from '@application/agent/use-cases/reply-to-conversation.use-case';
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

type InboundQueueJob = InboundMessageJob | ConversationReplyJob;

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
      default:
        this.logger.warn(`Ignored unknown job ${job.name}`);
    }
  }

  private async reply(job: Job<ConversationReplyJob>): Promise<void> {
    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.replyToConversation.execute(job.data),
    );
  }

  private async record(job: Job<InboundMessageJob>): Promise<void> {
    const message = this.parser.parse(job.data.payload);
    if (!message) {
      this.logger.debug(`Ignored unsupported inbound job ${job.id}`);
      return;
    }

    const { tenantId, providerMessageId } = job.data;
    const recorded = await this.tenantContext.runWithTenant(tenantId, () =>
      this.recordInboundMessage.execute({ ...message, providerMessageId }),
    );
    if (!recorded.needsReply) return;

    await this.queue.add(
      CONVERSATION_REPLY_JOB,
      {
        tenantId,
        conversationId: recorded.conversationId,
        clientId: recorded.clientId,
        clientPhoneE164: message.clientPhoneE164,
        providerMessageId,
      },
      {
        jobId: `${tenantId}-reply-${providerMessageId}`,
        delay: replyDebounceMs(),
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
