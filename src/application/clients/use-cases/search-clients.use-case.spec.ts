import { ClientRepository } from '@domain/clients/repositories/client.repository';

import { SearchClientsUseCase } from './search-clients.use-case';

describe('SearchClientsUseCase', () => {
  let clientRepository: jest.Mocked<Pick<ClientRepository, 'search'>>;
  let useCase: SearchClientsUseCase;

  beforeEach(() => {
    clientRepository = {
      search: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    };
    useCase = new SearchClientsUseCase(
      clientRepository as unknown as ClientRepository,
    );
  });

  it('caps the result so the whole client book never travels', async () => {
    const result = await useCase.execute({});

    expect(clientRepository.search).toHaveBeenCalledWith({
      term: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({ rows: [], total: 0, limit: 20, offset: 0 });
  });

  it('passes the term through to be matched by the database', async () => {
    await useCase.execute({ search: 'María', limit: 5, offset: 10 });

    expect(clientRepository.search).toHaveBeenCalledWith({
      term: 'María',
      limit: 5,
      offset: 10,
    });
  });
});
