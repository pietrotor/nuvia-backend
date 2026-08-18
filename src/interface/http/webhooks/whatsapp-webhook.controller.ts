import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Headers,
  Inject,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { createHash, timingSafeEqual } from 'node:crypto';

import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  INBOUND_MESSAGE_JOB,
  INBOUND_MESSAGES_QUEUE,
  LABEL_ASSOCIATION_JOB,
  LABEL_ENSURE_JOB,
} from '@infrastructure/queues/queue.constants';
import {
  InboundMessageJob,
  LabelAssociationJob,
  LabelEnsureJob,
} from '@infrastructure/queues/processors/inbound-messages.processor';

@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @InjectQueue(INBOUND_MESSAGES_QUEUE)
    private readonly inboundQueue: Queue<
      InboundMessageJob | LabelAssociationJob | LabelEnsureJob
    >,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async handle(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ accepted: true }> {
    if (!this.isValidSharedSecret(secret)) {
      throw new UnauthorizedException();
    }
    const instanceName = payload.instance;
    if (typeof instanceName !== 'string') {
      throw new UnauthorizedException();
    }

    const config =
      await this.businessConfigRepository.findByEvolutionInstanceNameUnscoped(
        instanceName,
      );
    if (
      !config ||
      !this.isAuthentic(payload, config.evolutionWebhookTokenHash)
    ) {
      throw new UnauthorizedException();
    }

    const event = String(payload.event ?? '')
      .toUpperCase()
      .replaceAll('.', '_');

    // Label sync is opt-in per tenant; skip the queue work entirely when off.
    const labelSyncOn = config.agentPolicy?.humanAttentionLabelSync === true;

    if (event === 'LABELS_ASSOCIATION') {
      if (labelSyncOn)
        await this.enqueueLabelAssociation(config.tenantId, payload);
      return { accepted: true };
    }

    if (event === 'CONNECTION_UPDATE') {
      if (labelSyncOn && this.isConnectedUpdate(payload)) {
        await this.enqueueLabelEnsure(config.tenantId);
      }
      return { accepted: true };
    }

    if (event !== 'MESSAGES_UPSERT') {
      return { accepted: true };
    }

    const providerMessageId = this.resolveProviderMessageId(payload);

    await this.inboundQueue.add(
      INBOUND_MESSAGE_JOB,
      { tenantId: config.tenantId, providerMessageId, payload },
      {
        jobId: `${config.tenantId}-${providerMessageId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return { accepted: true };
  }

  private async enqueueLabelAssociation(
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const data = payload.data as Record<string, unknown> | undefined;
    const chatJid = typeof data?.chatId === 'string' ? data.chatId : undefined;
    const labelId =
      typeof data?.labelId === 'string'
        ? data.labelId
        : typeof data?.labelId === 'number'
          ? String(data.labelId)
          : undefined;
    const action = data?.type === 'remove' ? 'remove' : 'add';
    if (!chatJid || !labelId) return;

    await this.inboundQueue.add(
      LABEL_ASSOCIATION_JOB,
      { tenantId, chatJid, labelId, action },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  private async enqueueLabelEnsure(tenantId: string): Promise<void> {
    await this.inboundQueue.add(
      LABEL_ENSURE_JOB,
      { tenantId },
      {
        // One provisioning attempt in flight per tenant: reconnects are frequent
        // and the job is idempotent.
        jobId: `${tenantId}-label-ensure`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: 5000,
      },
    );
  }

  private isConnectedUpdate(payload: Record<string, unknown>): boolean {
    const data = payload.data as Record<string, unknown> | undefined;
    const state = data?.state ?? data?.connection;
    return String(state ?? '').toLowerCase() === 'open';
  }

  private resolveProviderMessageId(payload: Record<string, unknown>): string {
    const data = payload.data as Record<string, unknown> | undefined;
    const key = data?.key as Record<string, unknown> | undefined;
    const id = key?.id ?? data?.id ?? payload.event;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private isAuthentic(
    payload: Record<string, unknown>,
    expectedHash: string | null,
  ): boolean {
    if (!expectedHash || typeof payload.apikey !== 'string') return false;
    const actualHash = createHash('sha256').update(payload.apikey).digest();
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      expected.length === actualHash.length &&
      timingSafeEqual(expected, actualHash)
    );
  }

  private isValidSharedSecret(secret: string | undefined): boolean {
    const expected = this.config.get<string>('WEBHOOK_SECRET');
    if (!expected || !secret) return false;
    const actualBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
