import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { InboundMessageJob } from '@infrastructure/queues/processors/inbound-messages.processor';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

describe('WhatsAppWebhookController', () => {
  const token = 'instance-token';
  const config = {
    tenantId: 'tenant-id',
    evolutionWebhookTokenHash: createHash('sha256').update(token).digest('hex'),
  } as BusinessConfig;

  let repository: jest.Mocked<BusinessConfigRepository>;
  let queue: jest.Mocked<Queue<InboundMessageJob>>;
  let controller: WhatsAppWebhookController;

  beforeEach(() => {
    repository = {
      findByEvolutionInstanceNameUnscoped: jest.fn().mockResolvedValue(config),
    } as unknown as jest.Mocked<BusinessConfigRepository>;
    queue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue<InboundMessageJob>>;
    controller = new WhatsAppWebhookController(
      {
        get: jest.fn().mockReturnValue('shared-secret'),
      } as unknown as ConfigService,
      repository,
      queue,
    );
  });

  it('resolves the tenant from the instance and enqueues an authenticated message', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'nuvi-tenant',
      apikey: token,
      data: { key: { id: 'message-id' } },
    };

    await expect(controller.handle('shared-secret', payload)).resolves.toEqual({
      accepted: true,
    });
    expect(queue.add).toHaveBeenCalledWith(
      'inbound',
      {
        tenantId: 'tenant-id',
        providerMessageId: 'message-id',
        payload,
      },
      expect.objectContaining({
        jobId: 'tenant-id-message-id',
        attempts: 3,
      }),
    );
  });

  it('rejects a webhook with an invalid provider token', async () => {
    await expect(
      controller.handle('shared-secret', {
        event: 'MESSAGES_UPSERT',
        instance: 'nuvi-tenant',
        apikey: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
