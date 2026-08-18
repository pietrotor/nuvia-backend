import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { WhatsAppSessionPort } from '@domain/messaging/ports/whatsapp-session.port';
import { GetWhatsAppStatusUseCase } from './get-whatsapp-status.use-case';

describe('GetWhatsAppStatusUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const instanceName = `nuvi-${tenantId}`;

  let repository: jest.Mocked<BusinessConfigRepository>;
  let sessions: jest.Mocked<WhatsAppSessionPort>;
  let useCase: GetWhatsAppStatusUseCase;

  beforeEach(() => {
    repository = {
      findByTenant: jest.fn().mockResolvedValue({
        tenantId,
        evolutionInstanceName: null,
        whatsappPhone: null,
      } as BusinessConfig),
      update: jest.fn(),
    } as unknown as jest.Mocked<BusinessConfigRepository>;
    sessions = {
      createSession: jest.fn(),
      getQr: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
    };
    useCase = new GetWhatsAppStatusUseCase(repository, sessions);
  });

  it('returns disconnected without calling the provider when no instance is stored', async () => {
    await expect(useCase.execute()).resolves.toEqual({
      configured: false,
      connected: false,
    });
    expect(sessions.getStatus).not.toHaveBeenCalled();
  });

  it('reports live connection when the provider socket is open', async () => {
    repository.findByTenant.mockResolvedValue({
      tenantId,
      evolutionInstanceName: instanceName,
      whatsappPhone: null,
    } as BusinessConfig);
    repository.update.mockResolvedValue({
      tenantId,
      evolutionInstanceName: instanceName,
      whatsappPhone: '+59171234567',
    } as BusinessConfig);
    sessions.getStatus.mockResolvedValue({
      instanceId: instanceName,
      instanceName,
      connected: true,
      phoneNumber: '+59171234567',
    });

    await expect(useCase.execute()).resolves.toEqual({
      configured: true,
      connected: true,
      phoneNumber: '+59171234567',
    });
    expect(repository.update).toHaveBeenCalledWith({
      whatsappPhone: '+59171234567',
    });
  });

  it('keeps configured true when the stored instance is offline', async () => {
    repository.findByTenant.mockResolvedValue({
      tenantId,
      evolutionInstanceName: instanceName,
      whatsappPhone: '+59171234567',
    } as BusinessConfig);
    sessions.getStatus.mockResolvedValue({
      instanceId: instanceName,
      instanceName,
      connected: false,
    });

    await expect(useCase.execute()).resolves.toEqual({
      configured: true,
      connected: false,
      phoneNumber: undefined,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
