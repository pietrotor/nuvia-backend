import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ForbiddenError, UnauthorizedError } from '@domain/common/exceptions';
import { User } from '@domain/users/entities/user.entity';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Role } from '@domain/users/value-objects/role.vo';
import { RoleGuard } from './role.guard';

const userWith = (role: Role): User =>
  new User({
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Ana',
    email: 'ana@ritmo.test',
    password: 'hash',
    role,
    isActive: true,
  });

const contextWith = (user?: User): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RoleGuard', () => {
  const guardFor = (allowedPermissions?: Permission[]) => {
    const reflector = {
      get: () => allowedPermissions,
    } as unknown as Reflector;

    return new RoleGuard(reflector);
  };

  it('lets a role with the listed permission through', () => {
    expect(
      guardFor([Permission.BUSINESS_CONFIG_WRITE]).canActivate(
        contextWith(userWith(Role.OWNER)),
      ),
    ).toBe(true);
  });

  it('rejects a role that lacks every listed permission', () => {
    expect(() =>
      guardFor([Permission.BUSINESS_CONFIG_WRITE]).canActivate(
        contextWith(userWith(Role.STAFF)),
      ),
    ).toThrow(ForbiddenError);
  });

  it('uses OR semantics across listed permissions', () => {
    expect(
      guardFor([Permission.TENANT_READ, Permission.TENANTS_ADMIN]).canActivate(
        contextWith(userWith(Role.SUPERADMIN)),
      ),
    ).toBe(true);
    expect(
      guardFor([Permission.TENANT_READ, Permission.TENANTS_ADMIN]).canActivate(
        contextWith(userWith(Role.STAFF)),
      ),
    ).toBe(true);
  });

  it('does not let superadmin inherit tenant permissions', () => {
    expect(() =>
      guardFor([Permission.BUSINESS_CONFIG_WRITE]).canActivate(
        contextWith(userWith(Role.SUPERADMIN)),
      ),
    ).toThrow(ForbiddenError);
  });

  it('rejects a request with no authenticated user', () => {
    expect(() =>
      guardFor([Permission.APPOINTMENTS_READ]).canActivate(contextWith()),
    ).toThrow(UnauthorizedError);
  });

  it('leaves the route open when no permission was declared', () => {
    expect(guardFor(undefined).canActivate(contextWith())).toBe(true);
  });
});
