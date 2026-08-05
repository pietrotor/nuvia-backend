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
import { INBOUND_MESSAGES_QUEUE } from '@infrastructure/queues/queue.constants';
import { InboundMessageJob } from '@infrastructure/queues/processors/inbound-messages.processor';

@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @InjectQueue(INBOUND_MESSAGES_QUEUE)
    private readonly inboundQueue: Queue<InboundMessageJob>,
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
    if (event !== 'MESSAGES_UPSERT') {
      return { accepted: true };
    }

    const providerMessageId = this.resolveProviderMessageId(payload);

    await this.inboundQueue.add(
      'inbound',
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
