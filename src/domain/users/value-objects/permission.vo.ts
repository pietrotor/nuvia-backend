import { Role } from './role.vo';

export enum Permission {
  // appointments
  APPOINTMENTS_READ = 'appointments:read',
  APPOINTMENTS_WRITE = 'appointments:write',
  // schedule blocks
  SCHEDULE_BLOCKS_READ = 'schedule_blocks:read',
  SCHEDULE_BLOCKS_WRITE = 'schedule_blocks:write',
  // catalog
  SERVICES_READ = 'services:read',
  SERVICES_WRITE = 'services:write',
  PROFESSIONALS_READ = 'professionals:read',
  PROFESSIONALS_WRITE = 'professionals:write',
  BRANCHES_READ = 'branches:read',
  BRANCHES_WRITE = 'branches:write',
  APPOINTMENT_NOTIFICATIONS_READ = 'appointment_notifications:read',
  APPOINTMENT_NOTIFICATIONS_WRITE = 'appointment_notifications:write',
  // clients
  CLIENTS_READ = 'clients:read',
  CLIENTS_WRITE = 'clients:write',
  // conversations
  CONVERSATIONS_READ = 'conversations:read',
  CONVERSATIONS_WRITE = 'conversations:write',
  // config / deposits / whatsapp / users — owner
  BUSINESS_CONFIG_READ = 'business_config:read',
  BUSINESS_CONFIG_WRITE = 'business_config:write',
  DEPOSITS_READ = 'deposits:read',
  DEPOSITS_WRITE = 'deposits:write',
  WHATSAPP_MANAGE = 'whatsapp:manage',
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  TENANT_READ = 'tenant:read',
  TENANT_WRITE = 'tenant:write',
  SUBSCRIPTION_READ = 'subscription:read',
  // superadmin
  TENANTS_ADMIN = 'tenants:admin',
  SUBSCRIPTIONS_ADMIN = 'subscriptions:admin',
  BACKFILL_RUN = 'backfill:run',
  AGENT_TRACES_READ = 'agent_traces:read',
  AGENT_TRACES_PRUNE = 'agent_traces:prune',
  EVENTS_READ = 'events:read',
}

const ALL_PERMISSIONS = Object.values(Permission);

const OWNER_PERMISSIONS: ReadonlySet<Permission> = new Set(
  ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== Permission.TENANTS_ADMIN &&
      permission !== Permission.SUBSCRIPTIONS_ADMIN &&
      permission !== Permission.BACKFILL_RUN &&
      permission !== Permission.AGENT_TRACES_READ &&
      permission !== Permission.AGENT_TRACES_PRUNE,
  ),
);

const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.APPOINTMENTS_READ,
  Permission.APPOINTMENTS_WRITE,
  Permission.SCHEDULE_BLOCKS_READ,
  Permission.SCHEDULE_BLOCKS_WRITE,
  Permission.SERVICES_READ,
  Permission.PROFESSIONALS_READ,
  Permission.BRANCHES_READ,
  Permission.APPOINTMENT_NOTIFICATIONS_READ,
  Permission.CLIENTS_READ,
  Permission.CLIENTS_WRITE,
  Permission.CONVERSATIONS_READ,
  Permission.CONVERSATIONS_WRITE,
  Permission.BUSINESS_CONFIG_READ,
  Permission.TENANT_READ,
  Permission.SUBSCRIPTION_READ,
  Permission.USERS_READ,
  Permission.EVENTS_READ,
]);

// Superadmin does not inherit tenant permissions: only platform ops + auth/me
// (auth/me is opened with TENANTS_ADMIN OR TENANT_READ).
const SUPERADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.TENANTS_ADMIN,
  Permission.SUBSCRIPTIONS_ADMIN,
  Permission.BACKFILL_RUN,
  Permission.AGENT_TRACES_READ,
  Permission.AGENT_TRACES_PRUNE,
]);

const PERMISSIONS_BY_ROLE: Record<Role, ReadonlySet<Permission>> = {
  [Role.OWNER]: OWNER_PERMISSIONS,
  [Role.STAFF]: STAFF_PERMISSIONS,
  [Role.SUPERADMIN]: SUPERADMIN_PERMISSIONS,
};

export function permissionsForRole(role: Role): ReadonlySet<Permission> {
  return PERMISSIONS_BY_ROLE[role];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}
