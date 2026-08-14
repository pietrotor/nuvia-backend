import { ConflictError, NotFoundError } from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class PlanNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.PLAN_NOT_FOUND, { id });
  }
}

export class PlanCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(ErrorCode.PLAN_CODE_ALREADY_EXISTS, { code });
  }
}

export class SubscriptionNotFoundError extends NotFoundError {
  constructor(tenantId?: string) {
    super(ErrorCode.SUBSCRIPTION_NOT_FOUND, { tenantId: tenantId ?? '' });
  }
}

export class SubscriptionAlreadyExistsError extends ConflictError {
  constructor(tenantId: string) {
    super(ErrorCode.SUBSCRIPTION_ALREADY_EXISTS, { tenantId });
  }
}

export class PlanLimitReachedError extends ConflictError {
  constructor(resource: string, limit: number) {
    super(ErrorCode.PLAN_LIMIT_REACHED, { resource, limit: String(limit) });
  }
}

export class PlanFeatureNotAvailableError extends ConflictError {
  constructor(feature: string) {
    super(ErrorCode.PLAN_FEATURE_NOT_AVAILABLE, { feature });
  }
}
