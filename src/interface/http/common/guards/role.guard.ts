import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { User } from '@domain/users/entities/user.entity';
import {
  Permission,
  roleHasPermission,
} from '@domain/users/value-objects/permission.vo';
import {
  ErrorCode,
  ForbiddenError,
  UnauthorizedError,
} from '@domain/common/exceptions';
import { META_PERMISSIONS } from '../decorators/role-protected.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[] | undefined>(
      META_PERMISSIONS,
      context.getHandler(),
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;

    if (!user) {
      throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS);
    }

    // OR semantics: any listed permission is enough. Superadmin does not inherit
    // tenant permissions — those endpoints must list TENANTS_ADMIN explicitly.
    const allowed = requiredPermissions.some((permission) =>
      roleHasPermission(user.role, permission),
    );

    if (!allowed) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_ROLE);
    }

    return true;
  }
}
