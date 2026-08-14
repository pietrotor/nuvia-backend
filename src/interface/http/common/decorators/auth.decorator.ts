import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';

import { Permission } from '@domain/users/value-objects/permission.vo';
import { RoleGuard } from '../guards/role.guard';
import { PermissionProtected } from './role-protected.decorator';

export function Auth(...permissions: Permission[]) {
  return applyDecorators(
    PermissionProtected(...permissions),
    UseGuards(AuthGuard(), RoleGuard),
    ApiBearerAuth(),
  );
}
