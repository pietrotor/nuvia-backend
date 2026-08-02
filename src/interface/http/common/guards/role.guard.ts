import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import {
  ErrorCode,
  ForbiddenError,
  UnauthorizedError,
} from '@domain/common/exceptions';
import { META_ROLES } from '../decorators/role-protected.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<Role[] | undefined>(
      META_ROLES,
      context.getHandler(),
    );

    if (!allowedRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;

    if (!user) {
      throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS);
    }

    // Superadmin does not inherit tenant roles: an endpoint that should be
    // reachable by support has to list SUPERADMIN explicitly.
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_ROLE);
    }

    return true;
  }
}
