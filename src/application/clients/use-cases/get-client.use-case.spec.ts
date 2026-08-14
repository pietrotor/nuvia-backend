import { Client } from '@domain/clients/entities/client.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';

import { GetClientUseCase } from './get-client.use-case';

const client = (): Client =>
  new Client({
    id: 'c1',
    tenantId: 't1',
    name: 'María López',
    phoneE164: '+59171234567',
    notes: 'Prefers afternoons',
  });

describe('GetClientUseCase', () => {
  let clientRepository: jest.Mocked<Pick<ClientRepository, 'findById'>>;
  let useCase: GetClientUseCase;

  beforeEach(() => {
    clientRepository = { findById: jest.fn().mockResolvedValue(client()) };
    useCase = new GetClientUseCase(
      clientRepository as unknown as ClientRepository,
    );
  });

  it('returns the client when it exists in the tenant', async () => {
    const result = await useCase.execute('c1');

    expect(result.name).toBe('María López');
    expect(result.notes).toBe('Prefers afternoons');
    expect(clientRepository.findById).toHaveBeenCalledWith('c1');
  });

  it('fails when the client is missing', async () => {
    clientRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      ClientNotFoundError,
    );
  });
});
