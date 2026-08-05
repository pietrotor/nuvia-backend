import { ErrorCode, InternalError } from '@domain/common/exceptions';

export class PromptPlatformLayerMissingError extends InternalError {
  constructor() {
    super(ErrorCode.AGENT_PROMPT_INCOMPLETE);
  }
}
