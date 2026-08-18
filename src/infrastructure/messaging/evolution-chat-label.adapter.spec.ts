import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { InternalError } from '@domain/common/exceptions';
import { EvolutionApiClient } from './evolution-api.client';
import { EvolutionChatLabelAdapter } from './evolution-chat-label.adapter';

describe('EvolutionChatLabelAdapter', () => {
  const config = {
    tenantId: 't1',
    evolutionInstanceName: 'nuvi-t1',
  } as BusinessConfig;

  let client: jest.Mocked<Pick<EvolutionApiClient, 'post'>>;
  let adapter: EvolutionChatLabelAdapter;

  beforeEach(() => {
    client = { post: jest.fn().mockResolvedValue({}) };
    adapter = new EvolutionChatLabelAdapter(
      client as unknown as EvolutionApiClient,
      {
        findByTenant: jest.fn().mockResolvedValue(config),
      } as unknown as BusinessConfigRepository,
    );
  });

  it('find-or-creates the label through the ensureLabel patch route', async () => {
    client.post.mockResolvedValue({
      id: 'label-7',
      name: 'Atención',
      created: true,
    });

    const result = await adapter.ensureHumanAttentionLabel({
      tenantId: 't1',
      name: 'Requiere atención humana',
    });

    expect(client.post).toHaveBeenCalledWith('/label/ensureLabel/nuvi-t1', {
      name: 'Requiere atención humana',
      color: expect.any(Number),
    });
    expect(result).toEqual({ labelId: 'label-7', created: true });
  });

  it('adds a label to a chat by phone number', async () => {
    await adapter.addChatLabel({
      tenantId: 't1',
      labelId: 'label-7',
      toE164: '+59170000001',
    });

    expect(client.post).toHaveBeenCalledWith('/label/handleLabel/nuvi-t1', {
      number: '59170000001',
      labelId: 'label-7',
      action: 'add',
    });
  });

  it('removes a label from a chat by phone number', async () => {
    await adapter.removeChatLabel({
      tenantId: 't1',
      labelId: 'label-7',
      toE164: '+59170000001',
    });

    expect(client.post).toHaveBeenCalledWith('/label/handleLabel/nuvi-t1', {
      number: '59170000001',
      labelId: 'label-7',
      action: 'remove',
    });
  });

  it('fails when the tenant has no linked instance', async () => {
    adapter = new EvolutionChatLabelAdapter(
      client as unknown as EvolutionApiClient,
      {
        findByTenant: jest
          .fn()
          .mockResolvedValue({ tenantId: 't1', evolutionInstanceName: null }),
      } as unknown as BusinessConfigRepository,
    );

    await expect(
      adapter.addChatLabel({
        tenantId: 't1',
        labelId: 'label-7',
        toE164: '+59170000001',
      }),
    ).rejects.toBeInstanceOf(InternalError);
    expect(client.post).not.toHaveBeenCalled();
  });
});
