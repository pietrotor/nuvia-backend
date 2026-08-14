import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import { DepositQrNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import { DepositQrRepository } from '@domain/deposits/repositories/deposit-qr.repository';
import { UpdateDepositQrUseCase } from './update-deposit-qr.use-case';

const depositQr = (
  overrides: Partial<{ isDefault: boolean; isActive: boolean; label: string }>,
): DepositQr =>
  new DepositQr({
    id: 'qr1',
    tenantId: 't1',
    label: overrides.label ?? 'BNB principal',
    storageKey: 'tenants/t1/deposit-qrs/qr1.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    isDefault: overrides.isDefault ?? false,
    isActive: overrides.isActive ?? true,
  });

describe('UpdateDepositQrUseCase', () => {
  let depositQrRepository: jest.Mocked<
    Pick<DepositQrRepository, 'findById' | 'save' | 'promoteToDefault'>
  >;
  let useCase: UpdateDepositQrUseCase;

  beforeEach(() => {
    depositQrRepository = {
      findById: jest.fn().mockResolvedValue(depositQr({})),
      save: jest.fn((saved: DepositQr) => Promise.resolve(saved)),
      promoteToDefault: jest.fn((_id: string) =>
        Promise.resolve<DepositQr | null>(depositQr({ isDefault: true })),
      ),
    };
    const audit: jest.Mocked<Pick<AuditRecorder, 'record'>> = {
      record: jest.fn(),
    };

    useCase = new UpdateDepositQrUseCase(
      depositQrRepository as unknown as DepositQrRepository,
      audit as unknown as AuditRecorder,
    );
  });

  it('does not touch a QR of another tenant', async () => {
    depositQrRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('qr1', { label: 'Ajeno' }),
    ).rejects.toBeInstanceOf(DepositQrNotFoundError);
    expect(depositQrRepository.save).not.toHaveBeenCalled();
  });

  it('moves the default through the repository so both rows change together', async () => {
    const updated = await useCase.execute('qr1', { isDefault: true });

    expect(depositQrRepository.promoteToDefault).toHaveBeenCalledWith('qr1');
    expect(updated.isDefault).toBe(true);
  });

  it('archives without deleting, and an archived QR gives up the default', async () => {
    depositQrRepository.findById.mockResolvedValue(
      depositQr({ isDefault: true }),
    );

    const archived = await useCase.execute('qr1', { isActive: false });

    expect(archived.isActive).toBe(false);
    expect(archived.isDefault).toBe(false);
    expect(depositQrRepository.promoteToDefault).not.toHaveBeenCalled();
  });

  it('archiving wins over promoting when both are asked for', async () => {
    const archived = await useCase.execute('qr1', {
      isActive: false,
      isDefault: true,
    });

    expect(archived.isActive).toBe(false);
    expect(depositQrRepository.promoteToDefault).not.toHaveBeenCalled();
  });

  it('trims the label', async () => {
    const renamed = await useCase.execute('qr1', { label: '  Union  ' });

    expect(renamed.label).toBe('Union');
  });
});
