import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';

import { Role } from '@domain/users/value-objects/role.vo';
import { RoleGuard } from '../guards/role.guard';
import { RoleProtected } from './role-protected.decorator';

export function Auth(...roles: Role[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(AuthGuard(), RoleGuard),
    ApiBearerAuth(),
  );
}
