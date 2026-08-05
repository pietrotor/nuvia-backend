export interface TenantContextPort {
  readonly tenantId: string | null;
  readonly userId: string | null;
  runWithTenant<T>(tenantId: string, fn: () => T): T;
}

export const TENANT_CONTEXT_PORT = 'TenantContextPort';
