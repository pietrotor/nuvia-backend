import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  ProfessionalAvatarNotFoundError,
  ProfessionalNotFoundError,
} from '@domain/professionals/exceptions/professional.exceptions';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';

import { DeleteProfessionalAvatarUseCase } from './delete-professional-avatar.use-case';

describe('DeleteProfessionalAvatarUseCase', () => {
  let professionalRepository: jest.Mocked<
    Pick<ProfessionalRepository, 'findById' | 'update'>
  >;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'delete'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: DeleteProfessionalAvatarUseCase;

  const withAvatar = new Professional({
    id: 'pro-1',
    tenantId: 'tenant-1',
    name: 'Ana',
    isActive: true,
    avatarStorageKey: 'tenants/tenant-1/professionals/pro-1/a.png',
    avatarMimeType: 'image/png',
  });

  beforeEach(() => {
    professionalRepository = {
      findById: jest.fn().mockResolvedValue(withAvatar),
      update: jest.fn().mockResolvedValue(
        new Professional({
          ...withAvatar,
          avatarStorageKey: null,
          avatarMimeType: null,
        }),
      ),
    };
    storage = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new DeleteProfessionalAvatarUseCase(
      professionalRepository as unknown as ProfessionalRepository,
      storage as unknown as ObjectStoragePort,
      audit as unknown as AuditRecorder,
    );
  });

  it('clears avatar columns and deletes the stored object', async () => {
    await useCase.execute('pro-1');

    expect(professionalRepository.update).toHaveBeenCalledWith('pro-1', {
      avatarStorageKey: null,
      avatarMimeType: null,
    });
    expect(storage.delete).toHaveBeenCalledWith(
      'tenants/tenant-1/professionals/pro-1/a.png',
    );
  });

  it('fails when there is no avatar to remove', async () => {
    professionalRepository.findById.mockResolvedValue(
      new Professional({
        ...withAvatar,
        avatarStorageKey: null,
        avatarMimeType: null,
      }),
    );

    await expect(useCase.execute('pro-1')).rejects.toBeInstanceOf(
      ProfessionalAvatarNotFoundError,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('fails when the professional does not exist', async () => {
    professionalRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      ProfessionalNotFoundError,
    );
  });
});
