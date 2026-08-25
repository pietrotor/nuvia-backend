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
  // Null means the tenant-wide service catalog; a value means a branch override.
  branchId: string | null;
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
    const { branchId, depositQrId, requiresDeposit } = assignment;
    if (!depositQrId) return;

    if (!requiresDeposit) throw new DepositQrNotAllowedForServiceError();

    // The lookup is tenant scoped, so a QR of another business is a 404 and never a
    // hint that it exists.
    const depositQr = await this.depositQrRepository.findById(depositQrId);
    const matchesScope =
      depositQr &&
      depositQr.isActive &&
      (branchId
        ? depositQr.branchId === null || depositQr.branchId === branchId
        : depositQr.branchId === null);
    if (!matchesScope) throw new DepositQrNotFoundError(depositQrId);
  }
}
