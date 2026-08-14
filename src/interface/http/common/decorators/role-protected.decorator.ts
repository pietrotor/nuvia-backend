import { SetMetadata } from '@nestjs/common';

import { Permission } from '@domain/users/value-objects/permission.vo';
import { Role } from '@domain/users/value-objects/role.vo';

/** @deprecated Prefer META_PERMISSIONS / PermissionProtected. Kept for legacy metadata. */
export const META_ROLES = 'roles';

export const META_PERMISSIONS = 'permissions';

/** @deprecated Prefer PermissionProtected. */
export const RoleProtected = (...roles: Role[]) =>
  SetMetadata(META_ROLES, roles);

export const PermissionProtected = (...permissions: Permission[]) =>
  SetMetadata(META_PERMISSIONS, permissions);
