import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import {
  ConflictError,
  DomainException,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  TenantContextMissingError,
  UnauthorizedError,
  ValidationError,
} from '@domain/common/exceptions';
import { I18nService } from '@infrastructure/i18n/i18n.service';
import { AppLoggerService } from '@infrastructure/logger/logger.service';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  path: string;
  timestamp: string;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly i18n: I18nService,
    private readonly logger: AppLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const body = this.toBody(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        this.internalDetail(exception),
        exception instanceof Error ? exception.stack : undefined,
        'ExceptionFilter',
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorBody {
    const base = { path, timestamp: new Date().toISOString() };

    if (exception instanceof DomainException) {
      return {
        ...base,
        statusCode: this.statusOf(exception),
        code: exception.code,
        message: this.i18n.translate(exception.code, exception.params),
      };
    }

    if (exception instanceof HttpException) {
      return { ...base, ...this.fromHttpException(exception) };
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: this.i18n.translate(ErrorCode.INTERNAL_ERROR),
    };
  }

  private statusOf(exception: DomainException): HttpStatus {
    if (exception instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (exception instanceof ValidationError) return HttpStatus.BAD_REQUEST;
    if (exception instanceof ConflictError) return HttpStatus.CONFLICT;
    if (exception instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (exception instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  // The validation pipe and Nest's own guards throw HttpException, so their
  // payload is reshaped here instead of being returned in a different format.
  private fromHttpException(
    exception: HttpException,
  ): Pick<ErrorBody, 'statusCode' | 'code' | 'message' | 'details'> {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    const messages =
      typeof payload === 'object' && payload !== null
        ? (payload as { message?: string | string[] }).message
        : payload;

    // Multer rejects an oversized upload before any handler runs, and its message is
    // in English: the client gets the catalog text like with any other error.
    if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
      return {
        statusCode,
        code: ErrorCode.PAYLOAD_TOO_LARGE,
        message: this.i18n.translate(ErrorCode.PAYLOAD_TOO_LARGE),
      };
    }

    if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(messages)) {
      return {
        statusCode,
        code: ErrorCode.VALIDATION_FAILED,
        message: this.i18n.translate(ErrorCode.VALIDATION_FAILED),
        details: messages,
      };
    }

    return {
      statusCode,
      code: this.fallbackCodeFor(statusCode),
      message: typeof messages === 'string' ? messages : exception.message,
    };
  }

  private fallbackCodeFor(statusCode: number): string {
    if (statusCode === HttpStatus.UNAUTHORIZED)
      return ErrorCode.INVALID_CREDENTIALS;
    if (statusCode === HttpStatus.FORBIDDEN) return ErrorCode.INSUFFICIENT_ROLE;
    if (statusCode === HttpStatus.BAD_REQUEST)
      return ErrorCode.VALIDATION_FAILED;

    return `HTTP_${statusCode}`;
  }

  private internalDetail(exception: unknown): string {
    if (exception instanceof TenantContextMissingError) {
      return `Missing tenant context: ${exception.detail}`;
    }

    return exception instanceof Error ? exception.message : String(exception);
  }
}
