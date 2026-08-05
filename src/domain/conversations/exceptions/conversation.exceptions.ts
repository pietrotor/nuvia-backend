import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class ConversationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.CONVERSATION_NOT_FOUND, { id });
  }
}
