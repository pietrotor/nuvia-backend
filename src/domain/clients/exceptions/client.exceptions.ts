import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ClientNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.CLIENT_NOT_FOUND, { id });
  }
}
