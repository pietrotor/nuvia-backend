import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class BusinessConfigNotFoundError extends NotFoundError {
  constructor() {
    super(ErrorCode.BUSINESS_CONFIG_NOT_FOUND);
  }
}
