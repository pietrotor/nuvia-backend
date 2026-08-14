import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Client } from '@domain/clients/entities/client.entity';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { CreateClientDto } from '../dto/create-client.dto';

@Injectable()
export class CreateClientUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly audit: AuditRecorder,
  ) {}

  /**
   * A phone already in the book returns the existing client instead of failing: the same
   * person can have written on WhatsApp before walking in, and the receptionist adding
   * her again should end up with one record, not an error.
   */
  async execute(dto: CreateClientDto): Promise<Client> {
    const existing = await this.clientRepository.findByPhone(dto.phoneE164);
    if (existing) return existing;

    const client = await this.clientRepository.findOrCreate({
      name: dto.name.trim(),
      phoneE164: dto.phoneE164,
      email: dto.email?.trim() || null,
      birthDate: dto.birthDate ?? null,
      identificationType: dto.identificationType?.trim() || null,
      identificationNumber: dto.identificationNumber?.trim() || null,
      address: dto.address?.trim() || null,
      notes: dto.notes?.trim() || null,
    });

    // The payload stays out on purpose: an audit row does not need to repeat the name and
    // phone of a client, and the id already says which record changed.
    await this.audit.record({
      action: AuditAction.CLIENT_CREATED,
      entity: 'client',
      entityId: client.id,
    });

    return client;
  }
}
