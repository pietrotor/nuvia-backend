import { createHash } from 'node:crypto';

import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import {
  ErrorCode,
  InternalError,
  ValidationError,
} from '@domain/common/exceptions';
import { WhatsAppSessionPort } from '@domain/messaging/ports/whatsapp-session.port';
import { CreateWhatsAppSessionUseCase } from './create-whatsapp-session.use-case';

describe('CreateWhatsAppSessionUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const instanceName = `nuvi-${tenantId}`;

  let repository: jest.Mocked<BusinessConfigRepository>;
  let sessions: jest.Mocked<WhatsAppSessionPort>;
  let useCase: CreateWhatsAppSessionUseCase;

  const configWithoutInstance = () =>
    ({
      tenantId,
      evolutionInstanceName: null,
    }) as BusinessConfig;

  const configWithInstance = () =>
    ({
      tenantId,
      evolutionInstanceName: instanceName,
    }) as BusinessConfig;

  beforeEach(() => {
    repository = {
      findByTenant: jest.fn().mockResolvedValue(configWithoutInstance()),
      update: jest.fn().mockResolvedValue(configWithoutInstance()),
    } as unknown as jest.Mocked<BusinessConfigRepository>;
    sessions = {
      createSession: jest.fn().mockResolvedValue({
        instanceId: 'evolution-id',
        instanceName,
        qrBase64: 'data:image/png;base64,qr',
        webhookToken: 'secret-token',
      }),
      getQr: jest.fn().mockResolvedValue({
        instanceId: instanceName,
        instanceName,
        qrBase64: 'data:image/png;base64,reuse',
      }),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
    };
    useCase = new CreateWhatsAppSessionUseCase(repository, sessions);
  });

  it('stores provider identity and only a hash of the webhook token', async () => {
    const result = await useCase.execute();

    expect(repository.update).toHaveBeenCalledWith({
      evolutionInstanceId: 'evolution-id',
      evolutionInstanceName: instanceName,
      evolutionWebhookTokenHash: createHash('sha256')
        .update('secret-token')
        .digest('hex'),
    });
    expect(result.webhookToken).toBeUndefined();
  });

  it('removes the provider instance when no webhook token is returned', async () => {
    sessions.createSession.mockResolvedValueOnce({
      instanceId: 'evolution-id',
      instanceName,
    });

    await expect(useCase.execute()).rejects.toBeInstanceOf(InternalError);
    expect(sessions.disconnect).toHaveBeenCalledWith(instanceName);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('reuses an existing offline instance without creating another', async () => {
    repository.findByTenant.mockResolvedValue(configWithInstance());
    sessions.getStatus.mockResolvedValue({
      instanceId: instanceName,
      instanceName,
      connected: false,
    });

    const result = await useCase.execute();

    expect(sessions.createSession).not.toHaveBeenCalled();
    expect(sessions.getQr).toHaveBeenCalledWith(instanceName);
    expect(result.qrBase64).toBe('data:image/png;base64,reuse');
  });

  it('does not request a QR when the session is already linked', async () => {
    repository.findByTenant.mockResolvedValue(configWithInstance());
    sessions.getStatus.mockResolvedValue({
      instanceId: instanceName,
      instanceName,
      connected: true,
      phoneNumber: '+59171234567',
    });

    await expect(useCase.execute()).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute()).rejects.toMatchObject({
      code: ErrorCode.WHATSAPP_SESSION_ALREADY_CONNECTED,
    });
    expect(sessions.getQr).not.toHaveBeenCalled();
  });
});
