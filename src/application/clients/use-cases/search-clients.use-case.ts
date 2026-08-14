import { Inject, Injectable } from '@nestjs/common';

import {
  CLIENT_REPOSITORY,
  ClientRepository,
  ClientSearchResult,
} from '@domain/clients/repositories/client.repository';
import { SearchClientsDto } from '../dto/search-clients.dto';

const DEFAULT_SEARCH_LIMIT = 20;

export interface SearchClientsResult extends ClientSearchResult {
  limit: number;
  offset: number;
}

@Injectable()
export class SearchClientsUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
  ) {}

  async execute(dto: SearchClientsDto): Promise<SearchClientsResult> {
    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const offset = dto.offset ?? 0;
    const result = await this.clientRepository.search({
      term: dto.search,
      limit,
      offset,
    });

    return { ...result, limit, offset };
  }
}
