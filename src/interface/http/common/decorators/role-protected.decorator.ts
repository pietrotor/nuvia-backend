import { SetMetadata } from '@nestjs/common';

import { Role } from '@domain/users/value-objects/role.vo';

export const META_ROLES = 'roles';

export const RoleProtected = (...roles: Role[]) =>
  SetMetadata(META_ROLES, roles);
