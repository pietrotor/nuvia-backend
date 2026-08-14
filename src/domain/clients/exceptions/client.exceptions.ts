import {
  ConflictError,
  NotFoundError,
} from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ClientNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.CLIENT_NOT_FOUND, { id });
  }
}

export class ClientPhoneAlreadyRegisteredError extends ConflictError {
  constructor(phoneE164: string) {
    super(ErrorCode.CLIENT_PHONE_ALREADY_REGISTERED, { phoneE164 });
  }
}
