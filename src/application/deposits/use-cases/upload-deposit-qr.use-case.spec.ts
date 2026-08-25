import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import { BranchRepository } from '@domain/branches/repositories/branch.repository';
import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import { InvalidDepositQrFileError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  CreateDepositQrData,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { DEPOSIT_QR_MAX_SIZE_BYTES } from '@domain/deposits/services/deposit-qr-image-validator';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';
import { UploadDepositQrUseCase } from './upload-deposit-qr.use-case';

describe('UploadDepositQrUseCase', () => {
  let depositQrRepository: jest.Mocked<
    Pick<DepositQrRepository, 'findAll' | 'create'>
  >;
  let branchRepository: jest.Mocked<Pick<BranchRepository, 'findById'>>;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'store'>>;
  let useCase: UploadDepositQrUseCase;

  const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const pngOfSize = (sizeBytes: number) =>
    Buffer.concat([
      PNG_SIGNATURE,
      Buffer.alloc(sizeBytes - PNG_SIGNATURE.length),
    ]);

  const image = { body: pngOfSize(64), mimeType: 'image/png' };

  beforeEach(() => {
    depositQrRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: CreateDepositQrData) =>
        Promise.resolve(
          new DepositQr({
            id: 'qr1',
            tenantId: 't1',
            branchId: data.branchId,
            label: data.label,
            storageKey: data.storageKey,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            isDefault: data.isDefault ?? false,
            isActive: true,
          }),
        ),
      ),
    };
    branchRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'b1',
        tenantId: 't1',
      } as Branch),
    };
    storage = {
      store: jest.fn((input) =>
        Promise.resolve({ key: input.key, url: 'https://storage/qr' }),
      ),
    };
    const tenantContext: jest.Mocked<Pick<TenantContextPort, 'tenantId'>> = {
      tenantId: 't1',
    };
    const audit: jest.Mocked<Pick<AuditRecorder, 'record'>> = {
      record: jest.fn(),
    };

    useCase = new UploadDepositQrUseCase(
      depositQrRepository as unknown as DepositQrRepository,
      branchRepository as unknown as BranchRepository,
      storage as unknown as ObjectStoragePort,
      tenantContext as unknown as TenantContextPort,
      audit as unknown as AuditRecorder,
    );
  });

  it('makes the first QR of a business the default one', async () => {
    const created = await useCase.execute({ label: '  BNB principal ' }, image);

    expect(created.isDefault).toBe(true);
    expect(created.label).toBe('BNB principal');
  });

  it('does not move the default when the business already has a QR', async () => {
    depositQrRepository.findAll.mockResolvedValue([
      new DepositQr({
        id: 'qr0',
        tenantId: 't1',
        label: 'Union',
        storageKey: 'tenants/t1/deposit-qrs/qr0.png',
        mimeType: 'image/png',
        sizeBytes: 10,
        isDefault: true,
        isActive: true,
      }),
    ]);

    const created = await useCase.execute({ label: 'BNB' }, image);

    expect(created.isDefault).toBe(false);
  });

  it('makes the first QR in a branch its default independently', async () => {
    const created = await useCase.execute(
      { label: 'BNB Norte', branchId: 'b1' },
      image,
    );

    expect(branchRepository.findById).toHaveBeenCalledWith('b1');
    expect(depositQrRepository.findAll).toHaveBeenCalledWith({
      branchId: 'b1',
    });
    expect(depositQrRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', isDefault: true }),
    );
    expect(created.branchId).toBe('b1');
  });

  it('treats an unknown or foreign branch as missing', async () => {
    branchRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ label: 'Ajeno', branchId: 'foreign' }, image),
    ).rejects.toBeInstanceOf(BranchNotFoundError);
    expect(storage.store).not.toHaveBeenCalled();
    expect(depositQrRepository.create).not.toHaveBeenCalled();
  });

  it('stores the image under the tenant of the caller', async () => {
    await useCase.execute({ label: 'BNB' }, image);

    expect(storage.store).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png', body: image.body }),
    );
    expect(storage.store.mock.calls[0][0].key).toMatch(
      /^tenants\/t1\/deposit-qrs\/[0-9a-f-]+\.png$/,
    );
  });

  it('rejects a file that is not one of the accepted image types', async () => {
    await expect(
      useCase.execute(
        { label: 'BNB' },
        { body: Buffer.from('%PDF'), mimeType: 'application/pdf' },
      ),
    ).rejects.toBeInstanceOf(InvalidDepositQrFileError);
    expect(storage.store).not.toHaveBeenCalled();
  });

  it('rejects an image over the size limit', async () => {
    await expect(
      useCase.execute(
        { label: 'BNB' },
        {
          body: pngOfSize(DEPOSIT_QR_MAX_SIZE_BYTES + 1),
          mimeType: 'image/png',
        },
      ),
    ).rejects.toBeInstanceOf(InvalidDepositQrFileError);
    expect(depositQrRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a file whose bytes are not the image type it claims to be', async () => {
    await expect(
      useCase.execute(
        { label: 'BNB' },
        { body: Buffer.from('fake-png-bytes'), mimeType: 'image/png' },
      ),
    ).rejects.toBeInstanceOf(InvalidDepositQrFileError);
    expect(storage.store).not.toHaveBeenCalled();
  });
});
