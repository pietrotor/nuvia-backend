import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Client } from '@domain/clients/entities/client.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';

import { CreateClientUseCase } from './create-client.use-case';

const client = (name: string): Client =>
  new Client({
    id: 'c1',
    tenantId: 't1',
    name,
    phoneE164: '+59171234567',
    notes: null,
  });

describe('CreateClientUseCase', () => {
  let clientRepository: jest.Mocked<
    Pick<ClientRepository, 'findByPhone' | 'findOrCreate'>
  >;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: CreateClientUseCase;

  beforeEach(() => {
    clientRepository = {
      findByPhone: jest.fn().mockResolvedValue(null),
      findOrCreate: jest.fn().mockResolvedValue(client('María López')),
    };
    audit = { record: jest.fn() };

    useCase = new CreateClientUseCase(
      clientRepository as unknown as ClientRepository,
      audit as unknown as AuditRecorder,
    );
  });

  it('creates the client and records who was added', async () => {
    const created = await useCase.execute({
      name: 'María López',
      phoneE164: '+59171234567',
    });

    expect(created.name).toBe('María López');
    expect(clientRepository.findOrCreate).toHaveBeenCalledWith({
      name: 'María López',
      phoneE164: '+59171234567',
      email: null,
      birthDate: null,
      identificationType: null,
      identificationNumber: null,
      address: null,
      notes: null,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CLIENT_CREATED,
        entityId: 'c1',
      }),
    );
  });

  it('trims the name so the same person is not stored twice with stray spaces', async () => {
    await useCase.execute({
      name: '  María López  ',
      phoneE164: '+59171234567',
    });

    expect(clientRepository.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'María López' }),
    );
  });

  it('returns the client already in the book instead of creating a second one', async () => {
    clientRepository.findByPhone.mockResolvedValue(client('María López'));

    const result = await useCase.execute({
      name: 'Otro Nombre',
      phoneE164: '+59171234567',
    });

    expect(result.name).toBe('María López');
    expect(clientRepository.findOrCreate).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
