import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import { DepositQrNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import { DepositQrRepository } from '@domain/deposits/repositories/deposit-qr.repository';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';
import { GetDepositQrImageUseCase } from './get-deposit-qr-image.use-case';

describe('GetDepositQrImageUseCase', () => {
  let depositQrRepository: jest.Mocked<Pick<DepositQrRepository, 'findById'>>;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'get'>>;
  let useCase: GetDepositQrImageUseCase;

  beforeEach(() => {
    depositQrRepository = {
      findById: jest.fn().mockResolvedValue(
        new DepositQr({
          id: 'qr1',
          tenantId: 't1',
          label: 'BNB principal',
          storageKey: 'tenants/t1/deposit-qrs/qr1.png',
          mimeType: 'image/png',
          sizeBytes: 8,
          isDefault: true,
          isActive: true,
        }),
      ),
    };
    storage = {
      get: jest.fn().mockResolvedValue({
        body: Buffer.from('qr-bytes'),
        contentType: null,
      }),
    };

    useCase = new GetDepositQrImageUseCase(
      depositQrRepository as unknown as DepositQrRepository,
      storage as unknown as ObjectStoragePort,
    );
  });

  it('reads the bytes by the key of the row, not by a URL from the client', async () => {
    const image = await useCase.execute('qr1');

    expect(storage.get).toHaveBeenCalledWith('tenants/t1/deposit-qrs/qr1.png');
    expect(image.body.toString()).toBe('qr-bytes');
  });

  it('falls back to the recorded type when the backend keeps no content type', async () => {
    const image = await useCase.execute('qr1');

    expect(image.mimeType).toBe('image/png');
  });

  it('does not serve the QR of another tenant', async () => {
    depositQrRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('qr1')).rejects.toBeInstanceOf(
      DepositQrNotFoundError,
    );
    expect(storage.get).not.toHaveBeenCalled();
  });
});
