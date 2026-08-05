import { createHash } from 'node:crypto';

import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { InternalError } from '@domain/common/exceptions';
import { WhatsAppSessionPort } from '@domain/messaging/ports/whatsapp-session.port';
import { CreateWhatsAppSessionUseCase } from './create-whatsapp-session.use-case';

describe('CreateWhatsAppSessionUseCase', () => {
  const config = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    evolutionInstanceName: null,
  } as BusinessConfig;

  let repository: jest.Mocked<BusinessConfigRepository>;
  let sessions: jest.Mocked<WhatsAppSessionPort>;
  let useCase: CreateWhatsAppSessionUseCase;

  beforeEach(() => {
    repository = {
      findByTenant: jest.fn().mockResolvedValue(config),
      update: jest.fn().mockResolvedValue(config),
    } as unknown as jest.Mocked<BusinessConfigRepository>;
    sessions = {
      createSession: jest.fn().mockResolvedValue({
        instanceId: 'evolution-id',
        instanceName: `nuvi-${config.tenantId}`,
        qrBase64: 'data:image/png;base64,qr',
        webhookToken: 'secret-token',
      }),
      getQr: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
    };
    useCase = new CreateWhatsAppSessionUseCase(repository, sessions);
  });

  it('stores provider identity and only a hash of the webhook token', async () => {
    const result = await useCase.execute();

    expect(repository.update).toHaveBeenCalledWith({
      evolutionInstanceId: 'evolution-id',
      evolutionInstanceName: `nuvi-${config.tenantId}`,
      evolutionWebhookTokenHash: createHash('sha256')
        .update('secret-token')
        .digest('hex'),
    });
    expect(result.webhookToken).toBeUndefined();
  });

  it('removes the provider instance when no webhook token is returned', async () => {
    sessions.createSession.mockResolvedValueOnce({
      instanceId: 'evolution-id',
      instanceName: `nuvi-${config.tenantId}`,
    });

    await expect(useCase.execute()).rejects.toBeInstanceOf(InternalError);
    expect(sessions.disconnect).toHaveBeenCalledWith(`nuvi-${config.tenantId}`);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
