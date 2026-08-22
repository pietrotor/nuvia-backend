import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { ClientRepository } from '@domain/clients/repositories/client.repository';

import { SearchClientsUseCase } from './search-clients.use-case';

describe('SearchClientsUseCase', () => {
  let clientRepository: jest.Mocked<Pick<ClientRepository, 'search'>>;
  let phoneNumbers: jest.Mocked<Pick<PhoneNumberService, 'buildSearchTerms'>>;
  let tenantCountry: jest.Mocked<
    Pick<TenantCountryService, 'getCurrentCountryCode'>
  >;
  let useCase: SearchClientsUseCase;

  beforeEach(() => {
    clientRepository = {
      search: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    };
    phoneNumbers = {
      buildSearchTerms: jest.fn((query: string) => [query]),
    };
    tenantCountry = {
      getCurrentCountryCode: jest.fn().mockResolvedValue('BO'),
    };
    useCase = new SearchClientsUseCase(
      clientRepository as unknown as ClientRepository,
      phoneNumbers as unknown as PhoneNumberService,
      tenantCountry as unknown as TenantCountryService,
    );
  });

  it('caps the result so the whole client book never travels', async () => {
    const result = await useCase.execute({});

    expect(clientRepository.search).toHaveBeenCalledWith({
      term: undefined,
      searchTerms: [],
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({ rows: [], total: 0, limit: 20, offset: 0 });
  });

  it('passes the term through to be matched by the database', async () => {
    await useCase.execute({ search: 'María', limit: 5, offset: 10 });

    expect(clientRepository.search).toHaveBeenCalledWith({
      term: 'María',
      searchTerms: ['María'],
      limit: 5,
      offset: 10,
    });
  });
});
