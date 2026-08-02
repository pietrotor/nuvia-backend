import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const RawHeaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] =>
    ctx.switchToHttp().getRequest<Request>().rawHeaders,
);
