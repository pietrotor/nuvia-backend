import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Client } from '@domain/clients/entities/client.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';
import {
  ClientNotFoundError,
  ClientPhoneAlreadyRegisteredError,
} from '@domain/clients/exceptions/client.exceptions';

import { UpdateClientUseCase } from './update-client.use-case';

const client = (overrides: Partial<Client> = {}): Client =>
  new Client({
    id: 'c1',
    tenantId: 't1',
    name: 'María López',
    phoneE164: '+59171234567',
    notes: null,
    ...overrides,
  });

describe('UpdateClientUseCase', () => {
  let clientRepository: jest.Mocked<
    Pick<ClientRepository, 'findById' | 'findByPhone' | 'update'>
  >;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: UpdateClientUseCase;

  beforeEach(() => {
    clientRepository = {
      findById: jest.fn().mockResolvedValue(client()),
      findByPhone: jest.fn().mockResolvedValue(null),
      update: jest
        .fn()
        .mockResolvedValue(client({ name: 'María Actualizada' })),
    };
    audit = { record: jest.fn() };

    useCase = new UpdateClientUseCase(
      clientRepository as unknown as ClientRepository,
      audit as unknown as AuditRecorder,
    );
  });

  it('updates the client and records the change', async () => {
    const updated = await useCase.execute('c1', { name: 'María Actualizada' });

    expect(updated.name).toBe('María Actualizada');
    expect(clientRepository.update).toHaveBeenCalledWith('c1', {
      name: 'María Actualizada',
      phoneE164: undefined,
      email: undefined,
      birthDate: undefined,
      identificationType: undefined,
      identificationNumber: undefined,
      address: undefined,
      notes: undefined,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CLIENT_UPDATED,
        entityId: 'c1',
      }),
    );
  });

  it('trims the name before saving', async () => {
    await useCase.execute('c1', { name: '  María Actualizada  ' });

    expect(clientRepository.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: 'María Actualizada' }),
    );
  });

  it('normalizes optional profile details before saving', async () => {
    await useCase.execute('c1', {
      email: '  maria@example.com ',
      identificationType: ' CI ',
      identificationNumber: ' 1234567 CB ',
      address: '  Av. América 123 ',
    });

    expect(clientRepository.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        email: 'maria@example.com',
        identificationType: 'CI',
        identificationNumber: '1234567 CB',
        address: 'Av. América 123',
      }),
    );
  });

  it('rejects a phone already used by another client', async () => {
    clientRepository.findByPhone.mockResolvedValue(
      client({ id: 'c2', phoneE164: '+59170000000' }),
    );

    await expect(
      useCase.execute('c1', { phoneE164: '+59170000000' }),
    ).rejects.toBeInstanceOf(ClientPhoneAlreadyRegisteredError);
    expect(clientRepository.update).not.toHaveBeenCalled();
  });

  it('allows keeping the same phone on the same client', async () => {
    await useCase.execute('c1', { phoneE164: '+59171234567' });

    expect(clientRepository.findByPhone).not.toHaveBeenCalled();
    expect(clientRepository.update).toHaveBeenCalled();
  });

  it('fails when the client does not exist', async () => {
    clientRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', { name: 'María' }),
    ).rejects.toBeInstanceOf(ClientNotFoundError);
  });
});
