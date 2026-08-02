import { ErrorCode } from './error-code';
import { InternalError } from './domain.exception';

// Programming error, not a user error: a scoped query ran outside a request or
// outside runWithTenant(). Never expose the detail to the client.
export class TenantContextMissingError extends InternalError {
  readonly detail: string;

  constructor(detail: string) {
    super(ErrorCode.TENANT_CONTEXT_MISSING);
    this.detail = detail;
  }
}
