import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ScheduleBlockNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.SCHEDULE_BLOCK_NOT_FOUND, { id });
  }
}
