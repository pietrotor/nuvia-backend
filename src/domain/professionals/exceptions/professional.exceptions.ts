import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ProfessionalNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.PROFESSIONAL_NOT_FOUND, { id });
  }
}
