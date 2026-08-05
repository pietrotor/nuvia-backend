import {
  ConflictError,
  NotFoundError,
} from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export class AppointmentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.APPOINTMENT_NOT_FOUND, { id });
  }
}

export class SlotUnavailableError extends ConflictError {
  constructor() {
    super(ErrorCode.SLOT_UNAVAILABLE);
  }
}

export class InvalidAppointmentTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super(ErrorCode.INVALID_APPOINTMENT_TRANSITION, { from, to });
  }
}
