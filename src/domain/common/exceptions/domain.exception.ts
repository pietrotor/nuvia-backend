import { ErrorCode } from './error-code';

export type ErrorParams = Record<string, string | number>;

export abstract class DomainException extends Error {
  readonly code: ErrorCode;
  readonly params: ErrorParams;

  constructor(code: ErrorCode, params: ErrorParams = {}) {
    super(code);
    this.name = new.target.name;
    this.code = code;
    this.params = params;
  }
}

export class NotFoundError extends DomainException {}

export class ValidationError extends DomainException {}

export class ConflictError extends DomainException {}

export class ForbiddenError extends DomainException {}

export class UnauthorizedError extends DomainException {}

export class InternalError extends DomainException {}
