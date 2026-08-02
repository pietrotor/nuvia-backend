import {
  ConflictError,
  DomainException,
  ErrorCode,
  InternalError,
  ValidationError,
} from '@domain/common/exceptions';

interface PostgresError {
  code?: string;
  column?: string;
  detail?: string;
}

// https://www.postgresql.org/docs/current/errcodes-appendix.html
export class DatabaseErrorTranslator {
  static toDomain(error: unknown): DomainException {
    if (error instanceof DomainException) {
      return error;
    }

    const { code, column } = (error ?? {}) as PostgresError;

    switch (code) {
      case '23505':
        return new ConflictError(ErrorCode.DUPLICATE_RECORD);
      case '23503':
        return new ValidationError(ErrorCode.RELATED_RECORD_NOT_FOUND);
      case '23502':
        return new ValidationError(ErrorCode.REQUIRED_FIELD_MISSING, {
          field: column ?? '',
        });
      case '23514':
        return new ValidationError(ErrorCode.CONSTRAINT_VIOLATION);
      default:
        return new InternalError(ErrorCode.INTERNAL_ERROR);
    }
  }
}
