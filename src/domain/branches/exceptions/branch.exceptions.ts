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
