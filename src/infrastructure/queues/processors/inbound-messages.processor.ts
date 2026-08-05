import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ProcessInboundMessageUseCase } from '@application/agent/use-cases/process-inbound-message.use-case';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { EvolutionWebhookParser } from '@infrastructure/messaging/evolution-webhook.parser';
import { INBOUND_MESSAGES_QUEUE } from '../queue.constants';

export interface InboundMessageJob {
  tenantId: string;
  providerMessageId: string;
  payload: unknown;
}

@Processor(INBOUND_MESSAGES_QUEUE)
export class InboundMessagesProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundMessagesProcessor.name);

  constructor(
    private readonly parser: EvolutionWebhookParser,
    private readonly processInboundMessage: ProcessInboundMessageUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {
    super();
  }

  async process(job: Job<InboundMessageJob>): Promise<void> {
    const message = this.parser.parse(job.data.payload);
    if (!message) {
      this.logger.debug(`Ignored unsupported inbound job ${job.id}`);
      return;
    }

    await this.tenantContext.runWithTenant(job.data.tenantId, () =>
      this.processInboundMessage.execute({
        ...message,
        tenantId: job.data.tenantId,
        providerMessageId: job.data.providerMessageId,
      }),
    );
  }
}
