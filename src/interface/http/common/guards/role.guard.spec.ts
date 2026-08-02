import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ForbiddenError, UnauthorizedError } from '@domain/common/exceptions';
import { User } from '@domain/users/entities/user.entity';
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
  const guardFor = (allowedRoles?: Role[]) => {
    const reflector = { get: () => allowedRoles } as unknown as Reflector;

    return new RoleGuard(reflector);
  };

  it('lets the listed roles through', () => {
    expect(
      guardFor([Role.OWNER]).canActivate(contextWith(userWith(Role.OWNER))),
    ).toBe(true);
  });

  it('rejects a role that is not listed', () => {
    expect(() =>
      guardFor([Role.OWNER]).canActivate(contextWith(userWith(Role.STAFF))),
    ).toThrow(ForbiddenError);
  });

  it('does not let superadmin inherit tenant roles', () => {
    expect(() =>
      guardFor([Role.OWNER]).canActivate(
        contextWith(userWith(Role.SUPERADMIN)),
      ),
    ).toThrow(ForbiddenError);
  });

  it('rejects a request with no authenticated user', () => {
    expect(() => guardFor([Role.OWNER]).canActivate(contextWith())).toThrow(
      UnauthorizedError,
    );
  });

  it('leaves the route open when no role was declared', () => {
    expect(guardFor(undefined).canActivate(contextWith())).toBe(true);
  });
});
