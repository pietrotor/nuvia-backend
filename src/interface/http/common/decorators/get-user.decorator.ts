import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { User } from '@domain/users/entities/user.entity';
import { ErrorCode, UnauthorizedError } from '@domain/common/exceptions';

export const GetUser = createParamDecorator(
  <K extends keyof User>(field: K | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;

    if (!user) {
      throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS);
    }

    return field ? user[field] : user;
  },
);
