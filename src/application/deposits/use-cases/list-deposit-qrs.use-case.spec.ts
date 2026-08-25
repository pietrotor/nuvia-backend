import { DepositQrRepository } from '@domain/deposits/repositories/deposit-qr.repository';
import { ListDepositQrsUseCase } from './list-deposit-qrs.use-case';

describe('ListDepositQrsUseCase', () => {
  it('passes branch and archive filters to the tenant-scoped repository', async () => {
    const depositQrRepository: jest.Mocked<
      Pick<DepositQrRepository, 'findAll'>
    > = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    const useCase = new ListDepositQrsUseCase(
      depositQrRepository as unknown as DepositQrRepository,
    );

    await useCase.execute({ branchId: 'b1', includeArchived: true });

    expect(depositQrRepository.findAll).toHaveBeenCalledWith({
      branchId: 'b1',
      includeArchived: true,
    });
  });

  it('keeps the unfiltered catalog behavior when no branch is selected', async () => {
    const depositQrRepository: jest.Mocked<
      Pick<DepositQrRepository, 'findAll'>
    > = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    const useCase = new ListDepositQrsUseCase(
      depositQrRepository as unknown as DepositQrRepository,
    );

    await useCase.execute({});

    expect(depositQrRepository.findAll).toHaveBeenCalledWith({});
  });
});
