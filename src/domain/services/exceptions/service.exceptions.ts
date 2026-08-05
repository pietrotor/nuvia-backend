import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ServiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.SERVICE_NOT_FOUND, { id });
  }
}
