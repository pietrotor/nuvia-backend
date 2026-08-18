import { NotFoundError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class AgentTraceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.AGENT_TRACE_NOT_FOUND, { id });
  }
}
