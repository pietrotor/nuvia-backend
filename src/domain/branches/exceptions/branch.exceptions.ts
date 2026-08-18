import {
  NotFoundError,
  ValidationError,
} from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class BranchNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.BRANCH_NOT_FOUND, { id });
  }
}

export class BranchRequiredError extends ValidationError {
  constructor() {
    super(ErrorCode.BRANCH_REQUIRED);
  }
}

export class ServiceNotOfferedAtBranchError extends ValidationError {
  constructor(serviceId: string, branchId: string) {
    super(ErrorCode.SERVICE_NOT_OFFERED_AT_BRANCH, { serviceId, branchId });
  }
}

export class ProfessionalNotAtBranchError extends ValidationError {
  constructor(professionalId: string, branchId: string) {
    super(ErrorCode.PROFESSIONAL_NOT_AT_BRANCH, {
      professionalId,
      branchId,
    });
  }
}

export class ServiceOfferWindowEmptyError extends ValidationError {
  constructor() {
    super(ErrorCode.SERVICE_OFFER_WINDOW_EMPTY);
  }
}

export class ServiceOfferWindowNotFoundError extends NotFoundError {
  constructor(branchId: string, professionalId: string, serviceId: string) {
    super(ErrorCode.SERVICE_OFFER_WINDOW_NOT_FOUND, {
      branchId,
      professionalId,
      serviceId,
    });
  }
}

export class ProfessionalDoesNotPerformServiceError extends ValidationError {
  constructor(professionalId: string, serviceId: string) {
    super(ErrorCode.PROFESSIONAL_DOES_NOT_PERFORM_SERVICE, {
      professionalId,
      serviceId,
    });
  }
}
