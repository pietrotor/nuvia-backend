import { Inject, Injectable } from '@nestjs/common';

import {
  DepositQrNotAllowedForServiceError,
  DepositQrNotFoundError,
} from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';

export interface DepositQrAssignment {
  depositQrId?: string | null;
  requiresDeposit: boolean;
}

// Pointing a service at a specific QR is the exception, so both writing paths check
// the same two things: the QR belongs to this business, and the service actually
// charges a deposit.
@Injectable()
export class DepositQrAssignmentValidator {
  constructor(
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrRepository: DepositQrRepository,
  ) {}

  async assertAssignable(assignment: DepositQrAssignment): Promise<void> {
    const { depositQrId, requiresDeposit } = assignment;
    if (!depositQrId) return;

    if (!requiresDeposit) throw new DepositQrNotAllowedForServiceError();

    // The lookup is tenant scoped, so a QR of another business is a 404 and never a
    // hint that it exists.
    const depositQr = await this.depositQrRepository.findById(depositQrId);
    if (!depositQr) throw new DepositQrNotFoundError(depositQrId);
  }
}
