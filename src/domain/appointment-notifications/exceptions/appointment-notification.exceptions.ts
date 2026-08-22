import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class NotificationContactNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.NOTIFICATION_CONTACT_NOT_FOUND, { id });
  }
}

export class NotificationSubscriptionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.NOTIFICATION_SUBSCRIPTION_NOT_FOUND, { id });
  }
}

export class NotificationPhoneAlreadyRegisteredError extends ConflictError {
  constructor() {
    super(ErrorCode.NOTIFICATION_PHONE_ALREADY_REGISTERED);
  }
}

export class NotificationProfessionalAlreadySubscribedError extends ConflictError {
  constructor() {
    super(ErrorCode.NOTIFICATION_PROFESSIONAL_ALREADY_SUBSCRIBED);
  }
}

export class NotificationBranchObserverLimitError extends ValidationError {
  constructor(limit: number) {
    super(ErrorCode.NOTIFICATION_BRANCH_OBSERVER_LIMIT, { limit });
  }
}

export class NotificationContactDeactivatedError extends ValidationError {
  constructor() {
    super(ErrorCode.NOTIFICATION_CONTACT_DEACTIVATED);
  }
}

export class OutboundDeferredError extends ConflictError {
  constructor(retryAfterMs: number) {
    super(ErrorCode.OUTBOUND_DEFERRED, { retryAfterMs });
  }
}

export class OutboundBlockedError extends ValidationError {
  constructor() {
    super(ErrorCode.OUTBOUND_BLOCKED);
  }
}
