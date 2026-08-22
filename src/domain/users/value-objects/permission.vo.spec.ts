import {
  Permission,
  permissionsForRole,
  roleHasPermission,
} from './permission.vo';
import { Role } from './role.vo';

describe('permissionsForRole', () => {
  it('gives owner every tenant permission but not platform admin ones', () => {
    const permissions = permissionsForRole(Role.OWNER);

    expect(permissions.has(Permission.BUSINESS_CONFIG_WRITE)).toBe(true);
    expect(permissions.has(Permission.WHATSAPP_MANAGE)).toBe(true);
    expect(permissions.has(Permission.APPOINTMENT_NOTIFICATIONS_WRITE)).toBe(
      true,
    );
    expect(permissions.has(Permission.EVENTS_READ)).toBe(true);
    expect(permissions.has(Permission.SUBSCRIPTION_READ)).toBe(true);
    expect(permissions.has(Permission.TENANTS_ADMIN)).toBe(false);
    expect(permissions.has(Permission.SUBSCRIPTIONS_ADMIN)).toBe(false);
    expect(permissions.has(Permission.BACKFILL_RUN)).toBe(false);
    expect(permissions.has(Permission.AGENT_TRACES_READ)).toBe(false);
    expect(permissions.has(Permission.AGENT_TRACES_PRUNE)).toBe(false);
  });

  it('limits staff to the operational read/write set', () => {
    const permissions = permissionsForRole(Role.STAFF);

    expect(permissions.has(Permission.APPOINTMENTS_WRITE)).toBe(true);
    expect(permissions.has(Permission.APPOINTMENT_NOTIFICATIONS_READ)).toBe(
      true,
    );
    expect(permissions.has(Permission.APPOINTMENT_NOTIFICATIONS_WRITE)).toBe(
      false,
    );
    expect(permissions.has(Permission.SERVICES_READ)).toBe(true);
    expect(permissions.has(Permission.USERS_READ)).toBe(true);
    expect(permissions.has(Permission.SUBSCRIPTION_READ)).toBe(true);
    expect(permissions.has(Permission.SERVICES_WRITE)).toBe(false);
    expect(permissions.has(Permission.USERS_WRITE)).toBe(false);
    expect(permissions.has(Permission.WHATSAPP_MANAGE)).toBe(false);
    expect(permissions.has(Permission.TENANTS_ADMIN)).toBe(false);
  });

  it('does not let superadmin inherit tenant permissions', () => {
    const permissions = permissionsForRole(Role.SUPERADMIN);

    expect(permissions.has(Permission.TENANTS_ADMIN)).toBe(true);
    expect(permissions.has(Permission.SUBSCRIPTIONS_ADMIN)).toBe(true);
    expect(permissions.has(Permission.BACKFILL_RUN)).toBe(true);
    expect(permissions.has(Permission.AGENT_TRACES_READ)).toBe(true);
    expect(permissions.has(Permission.AGENT_TRACES_PRUNE)).toBe(true);
    expect(permissions.has(Permission.TENANT_READ)).toBe(false);
    expect(permissions.has(Permission.APPOINTMENTS_READ)).toBe(false);
  });
});

describe('roleHasPermission', () => {
  it('matches the role map', () => {
    expect(roleHasPermission(Role.OWNER, Permission.DEPOSITS_WRITE)).toBe(true);
    expect(roleHasPermission(Role.STAFF, Permission.DEPOSITS_WRITE)).toBe(
      false,
    );
    expect(roleHasPermission(Role.SUPERADMIN, Permission.TENANTS_ADMIN)).toBe(
      true,
    );
  });
});
