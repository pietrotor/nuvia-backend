import {
  ErrorCode,
  ForbiddenError,
  NotFoundError,
} from '@domain/common/exceptions';

export class TenantNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.TENANT_NOT_FOUND, { id });
  }
}

export class TenantSuspendedError extends ForbiddenError {
  constructor(name: string) {
    super(ErrorCode.TENANT_SUSPENDED, { name });
  }
}
