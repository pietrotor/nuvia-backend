import { NotFoundError, ValidationError } from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class DepositQrNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.DEPOSIT_QR_NOT_FOUND, { id });
  }
}

export class InvalidDepositQrFileError extends ValidationError {
  constructor(maxSizeMb: number) {
    super(ErrorCode.INVALID_DEPOSIT_QR_FILE, { maxSizeMb });
  }
}

export class DepositQrNotAllowedForServiceError extends ValidationError {
  constructor() {
    super(ErrorCode.DEPOSIT_QR_REQUIRES_DEPOSIT_SERVICE);
  }
}
