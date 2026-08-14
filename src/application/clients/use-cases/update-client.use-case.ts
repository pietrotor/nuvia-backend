import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Client } from '@domain/clients/entities/client.entity';
import {
  ClientNotFoundError,
  ClientPhoneAlreadyRegisteredError,
} from '@domain/clients/exceptions/client.exceptions';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { UpdateClientDto } from '../dto/update-client.dto';

@Injectable()
export class UpdateClientUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateClientDto): Promise<Client> {
    const current = await this.clientRepository.findById(id);
    if (!current) throw new ClientNotFoundError(id);

    if (dto.phoneE164 && dto.phoneE164 !== current.phoneE164) {
      const existing = await this.clientRepository.findByPhone(dto.phoneE164);
      if (existing && existing.id !== id) {
        throw new ClientPhoneAlreadyRegisteredError(dto.phoneE164);
      }
    }

    const data = {
      name: dto.name?.trim(),
      phoneE164: dto.phoneE164,
      email: dto.email === undefined ? undefined : dto.email?.trim() || null,
      birthDate: dto.birthDate === undefined ? undefined : dto.birthDate,
      identificationType:
        dto.identificationType === undefined
          ? undefined
          : dto.identificationType?.trim() || null,
      identificationNumber:
        dto.identificationNumber === undefined
          ? undefined
          : dto.identificationNumber?.trim() || null,
      address:
        dto.address === undefined ? undefined : dto.address?.trim() || null,
      notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
    };
    const updated = await this.clientRepository.update(id, data);
    if (!updated) throw new ClientNotFoundError(id);

    await this.audit.record({
      action: AuditAction.CLIENT_UPDATED,
      entity: 'client',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }
}
