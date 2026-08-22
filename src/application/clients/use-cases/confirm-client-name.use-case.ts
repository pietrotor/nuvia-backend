import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Client } from '@domain/clients/entities/client.entity';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { ClientNameRequiredError } from '@domain/appointments/exceptions/appointment.exceptions';
import { normalizeConfirmedClientName } from '@domain/clients/services/confirmed-client-name';

export interface ConfirmClientNameInput {
  clientId: string;
  name: string;
}

@Injectable()
export class ConfirmClientNameUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: ConfirmClientNameInput): Promise<Client> {
    const current = await this.clientRepository.findById(input.clientId);
    if (!current) throw new ClientNotFoundError(input.clientId);

    const name = normalizeConfirmedClientName(input.name);
    if (!name) throw new ClientNameRequiredError();

    const updated = await this.clientRepository.update(current.id, { name });
    if (!updated) throw new ClientNotFoundError(input.clientId);

    await this.audit.record({
      action: AuditAction.CLIENT_UPDATED,
      entity: 'client',
      entityId: updated.id,
      before: { name: current.name },
      after: { name },
    });

    return updated;
  }
}
