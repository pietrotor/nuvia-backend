import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
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
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  async execute(id: string, dto: UpdateClientDto): Promise<Client> {
    const current = await this.clientRepository.findById(id);
    if (!current) throw new ClientNotFoundError(id);

    const country = await this.tenantCountry.getCurrentCountryCode();
    const phoneE164 =
      dto.phoneE164 === undefined
        ? undefined
        : this.phoneNumbers.resolvePhoneForWrite(
            dto.phoneE164,
            current.phoneE164,
            country,
          );

    if (phoneE164 && phoneE164 !== current.phoneE164) {
      const existing = await this.clientRepository.findByPhone(phoneE164);
      if (existing && existing.id !== id) {
        throw new ClientPhoneAlreadyRegisteredError(phoneE164);
      }
    }

    const data = {
      name: dto.name?.trim(),
      phoneE164,
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
