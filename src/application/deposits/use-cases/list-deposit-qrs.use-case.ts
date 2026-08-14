import { Inject, Injectable } from '@nestjs/common';

import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';

@Injectable()
export class ListDepositQrsUseCase {
  constructor(
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
  ) {}

  execute(options?: { includeArchived?: boolean }): Promise<DepositQr[]> {
    return this.depositQrRepository.findAll(options);
  }
}
