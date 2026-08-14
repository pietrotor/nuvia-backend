import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import {
  DepositQrNotAllowedForServiceError,
  DepositQrNotFoundError,
} from '@domain/deposits/exceptions/deposit-qr.exceptions';
import { DepositQrRepository } from '@domain/deposits/repositories/deposit-qr.repository';
import { DepositQrAssignmentValidator } from './deposit-qr-assignment-validator.service';

describe('DepositQrAssignmentValidator', () => {
  let depositQrRepository: jest.Mocked<Pick<DepositQrRepository, 'findById'>>;
  let validator: DepositQrAssignmentValidator;

  beforeEach(() => {
    depositQrRepository = {
      findById: jest.fn().mockResolvedValue(
        new DepositQr({
          id: 'qr1',
          tenantId: 't1',
          label: 'BNB principal',
          storageKey: 'tenants/t1/deposit-qrs/qr1.png',
          mimeType: 'image/png',
          sizeBytes: 100,
          isDefault: true,
          isActive: true,
        }),
      ),
    };

    validator = new DepositQrAssignmentValidator(
      depositQrRepository as unknown as DepositQrRepository,
    );
  });

  it('accepts a QR of the business on a service that charges a deposit', async () => {
    await expect(
      validator.assertAssignable({
        depositQrId: 'qr1',
        requiresDeposit: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not look anything up when no QR is assigned', async () => {
    await validator.assertAssignable({ requiresDeposit: false });

    expect(depositQrRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects assigning a QR to a service that charges no deposit', async () => {
    await expect(
      validator.assertAssignable({
        depositQrId: 'qr1',
        requiresDeposit: false,
      }),
    ).rejects.toBeInstanceOf(DepositQrNotAllowedForServiceError);
  });

  it('treats a QR of another tenant as missing', async () => {
    depositQrRepository.findById.mockResolvedValue(null);

    await expect(
      validator.assertAssignable({
        depositQrId: 'foreign',
        requiresDeposit: true,
      }),
    ).rejects.toBeInstanceOf(DepositQrNotFoundError);
  });
});
