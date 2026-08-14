import {
  NotFoundError,
  ValidationError,
} from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ProfessionalNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.PROFESSIONAL_NOT_FOUND, { id });
  }
}

export class ProfessionalAvatarNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.PROFESSIONAL_AVATAR_NOT_FOUND, { id });
  }
}

export class InvalidProfessionalAvatarFileError extends ValidationError {
  constructor(maxSizeMb: number) {
    super(ErrorCode.INVALID_PROFESSIONAL_AVATAR_FILE, { maxSizeMb });
  }
}
