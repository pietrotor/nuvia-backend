import {
  ConflictError,
  ErrorCode,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@domain/common/exceptions';

export class UserNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.USER_NOT_FOUND, { id });
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super(ErrorCode.INVALID_CREDENTIALS);
  }
}

export class UserInactiveError extends UnauthorizedError {
  constructor() {
    super(ErrorCode.USER_INACTIVE);
  }
}

export class SessionTenantMismatchError extends UnauthorizedError {
  constructor() {
    super(ErrorCode.SESSION_TENANT_MISMATCH);
  }
}

export class EmailAlreadyRegisteredError extends ConflictError {
  constructor(email: string) {
    super(ErrorCode.EMAIL_ALREADY_REGISTERED, { email });
  }
}

export class CannotDemoteLastOwnerError extends ValidationError {
  constructor() {
    super(ErrorCode.CANNOT_DEMOTE_LAST_OWNER);
  }
}

export class SuperadminCannotBelongToTenantError extends ValidationError {
  constructor() {
    super(ErrorCode.SUPERADMIN_CANNOT_BELONG_TO_TENANT);
  }
}
