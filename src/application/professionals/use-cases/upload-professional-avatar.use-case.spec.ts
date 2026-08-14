import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { InvalidProfessionalAvatarFileError } from '@domain/professionals/exceptions/professional.exceptions';
import { ProfessionalRepository } from '@domain/professionals/repositories/professional.repository';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';

import { UploadProfessionalAvatarUseCase } from './upload-professional-avatar.use-case';

const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

describe('UploadProfessionalAvatarUseCase', () => {
  let professionalRepository: jest.Mocked<
    Pick<ProfessionalRepository, 'findById' | 'update'>
  >;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'store' | 'delete'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: UploadProfessionalAvatarUseCase;

  const existing = new Professional({
    id: 'pro-1',
    tenantId: 'tenant-1',
    name: 'Ana',
    isActive: true,
    avatarStorageKey: 'tenants/tenant-1/professionals/pro-1/old.png',
    avatarMimeType: 'image/png',
  });

  beforeEach(() => {
    professionalRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(
        new Professional({
          ...existing,
          avatarStorageKey: 'tenants/tenant-1/professionals/pro-1/new.png',
          avatarMimeType: 'image/png',
        }),
      ),
    };
    storage = {
      store: jest.fn().mockResolvedValue({
        key: 'tenants/tenant-1/professionals/pro-1/new.png',
        url: 'file://ignored',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const tenantContext: TenantContextPort = {
      tenantId: 'tenant-1',
    } as TenantContextPort;

    useCase = new UploadProfessionalAvatarUseCase(
      professionalRepository as unknown as ProfessionalRepository,
      storage as unknown as ObjectStoragePort,
      tenantContext,
      audit as unknown as AuditRecorder,
    );
  });

  it('stores the image and replaces the previous avatar key', async () => {
    await useCase.execute('pro-1', {
      body: pngHeader,
      mimeType: 'image/png',
    });

    expect(storage.store).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'image/png',
        body: pngHeader,
      }),
    );
    expect(professionalRepository.update).toHaveBeenCalledWith(
      'pro-1',
      expect.objectContaining({
        avatarMimeType: 'image/png',
      }),
    );
    expect(storage.delete).toHaveBeenCalledWith(
      'tenants/tenant-1/professionals/pro-1/old.png',
    );
  });

  it('rejects files that are not real images', async () => {
    await expect(
      useCase.execute('pro-1', {
        body: Buffer.from('not-an-image'),
        mimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(InvalidProfessionalAvatarFileError);
    expect(storage.store).not.toHaveBeenCalled();
  });
});
