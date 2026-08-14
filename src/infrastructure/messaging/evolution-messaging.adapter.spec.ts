import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { EvolutionApiClient } from './evolution-api.client';
import { EvolutionMessagingAdapter } from './evolution-messaging.adapter';

describe('EvolutionMessagingAdapter', () => {
  const config = {
    tenantId: 't1',
    evolutionInstanceName: 'nuvi-t1',
  } as BusinessConfig;
  const target = { tenantId: 't1', toE164: '+59170000001' };

  let client: jest.Mocked<Pick<EvolutionApiClient, 'post'>>;
  let logger: jest.Mocked<LoggerPort>;
  let adapter: EvolutionMessagingAdapter;

  beforeEach(() => {
    client = {
      post: jest.fn().mockResolvedValue({ key: { id: 'wamid.out' } }),
    };
    logger = { error: jest.fn(), warn: jest.fn() };
    adapter = new EvolutionMessagingAdapter(
      client as unknown as EvolutionApiClient,
      {
        findByTenant: jest.fn().mockResolvedValue(config),
      } as unknown as BusinessConfigRepository,
      logger,
    );
  });

  it('asks the provider to type before delivering, and waits longer than that', async () => {
    await adapter.sendText({ ...target, text: 'Hola', typingDelayMs: 4_000 });

    expect(client.post).toHaveBeenCalledWith(
      '/message/sendText/nuvi-t1',
      expect.objectContaining({ number: '59170000001', delay: 4_000 }),
      expect.objectContaining({ timeoutMs: expect.any(Number) as number }),
    );
    const [, , options] = client.post.mock.calls[0];
    expect(options?.timeoutMs).toBeGreaterThan(4_000);
  });

  it('sends a message the owner typed without any indicator', async () => {
    await adapter.sendText({ ...target, text: 'Ya te atiendo' });

    expect(client.post).toHaveBeenCalledWith('/message/sendText/nuvi-t1', {
      number: '59170000001',
      text: 'Ya te atiendo',
    });
  });

  it('delivers without the indicator when the provider refuses it', async () => {
    client.post
      .mockRejectedValueOnce(
        new InternalError(ErrorCode.EVOLUTION_API_ERROR, { status: 400 }),
      )
      .mockResolvedValue({ key: { id: 'wamid.out' } });

    await expect(
      adapter.sendText({ ...target, text: 'Hola', typingDelayMs: 4_000 }),
    ).resolves.toEqual({ providerMessageId: 'wamid.out' });

    expect(client.post).toHaveBeenCalledTimes(2);
    expect(client.post).toHaveBeenLastCalledWith('/message/sendText/nuvi-t1', {
      number: '59170000001',
      text: 'Hola',
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not send twice when the first attempt only timed out', async () => {
    client.post.mockRejectedValue(
      new InternalError(ErrorCode.EVOLUTION_API_ERROR, { cause: 'timeout' }),
    );

    await expect(
      adapter.sendText({ ...target, text: 'Hola', typingDelayMs: 4_000 }),
    ).rejects.toBeInstanceOf(InternalError);

    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('marks the client message as read on her chat', async () => {
    await adapter.markAsRead({ ...target, providerMessageId: 'wamid.in' });

    expect(client.post).toHaveBeenCalledWith(
      '/chat/markMessageAsRead/nuvi-t1',
      {
        readMessages: [
          {
            remoteJid: '59170000001@s.whatsapp.net',
            fromMe: false,
            id: 'wamid.in',
          },
        ],
      },
    );
  });

  it('shows the typing indicator on its own while the agent thinks', async () => {
    await adapter.showTyping({ ...target, durationMs: 5_000 });

    expect(client.post).toHaveBeenCalledWith(
      '/chat/sendPresence/nuvi-t1',
      { number: '59170000001', presence: 'composing', delay: 5_000 },
      expect.objectContaining({ timeoutMs: expect.any(Number) as number }),
    );
  });
});
