import { Inject, Injectable } from '@nestjs/common';

import { Client } from '@domain/clients/entities/client.entity';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';

@Injectable()
export class GetClientUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
  ) {}

  async execute(id: string): Promise<Client> {
    const client = await this.clientRepository.findById(id);
    if (!client) throw new ClientNotFoundError(id);

    return client;
  }
}
