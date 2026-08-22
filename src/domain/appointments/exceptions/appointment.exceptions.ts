import {
  ConflictError,
  NotFoundError,
  ValidationError,
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

export class ClientNameRequiredError extends ValidationError {
  constructor() {
    super(ErrorCode.CLIENT_NAME_REQUIRED);
  }
}

export class BookingAnswersIncompleteError extends ValidationError {
  constructor() {
    super(ErrorCode.BOOKING_ANSWERS_INCOMPLETE);
  }
}

export class BookingQuestionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.BOOKING_QUESTION_NOT_FOUND, { id });
  }
}

export class BookingAnswerInvalidError extends ValidationError {
  constructor(id: string) {
    super(ErrorCode.BOOKING_ANSWER_INVALID, { id });
  }
}
