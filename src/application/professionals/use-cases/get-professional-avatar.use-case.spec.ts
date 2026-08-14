import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  ProfessionalAvatarNotFoundError,
  ProfessionalNotFoundError,
} from '@domain/professionals/exceptions/professional.exceptions';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';

import { GetProfessionalAvatarUseCase } from './get-professional-avatar.use-case';

describe('GetProfessionalAvatarUseCase', () => {
  let professionalRepository: jest.Mocked<
    Pick<ProfessionalRepository, 'findById'>
  >;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'get'>>;
  let useCase: GetProfessionalAvatarUseCase;

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
    };
    storage = {
      get: jest.fn().mockResolvedValue({
        body: Buffer.from('img'),
        contentType: 'image/png',
      }),
    };
    useCase = new GetProfessionalAvatarUseCase(
      professionalRepository as unknown as ProfessionalRepository,
      storage as unknown as ObjectStoragePort,
    );
  });

  it('streams the stored avatar bytes', async () => {
    const result = await useCase.execute('pro-1');

    expect(storage.get).toHaveBeenCalledWith(
      'tenants/tenant-1/professionals/pro-1/a.png',
    );
    expect(result).toEqual({
      body: Buffer.from('img'),
      mimeType: 'image/png',
    });
  });

  it('fails when the professional has no avatar', async () => {
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
  });

  it('fails when the professional does not exist', async () => {
    professionalRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      ProfessionalNotFoundError,
    );
  });
});
