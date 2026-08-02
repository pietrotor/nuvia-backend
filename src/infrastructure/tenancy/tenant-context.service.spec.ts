import { TenantContextMissingError } from '@domain/common/exceptions';
import { Role } from '@domain/users/value-objects/role.vo';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(() => {
    service = new TenantContextService();
  });

  it('starts empty and gets filled in by whoever authenticates', () => {
    service.run(() => {
      expect(service.tenantId).toBeNull();

      service.set({ tenantId: 'tenant-1', userId: 'user-1', role: Role.OWNER });

      expect(service.tenantId).toBe('tenant-1');
      expect(service.role).toBe(Role.OWNER);
    });
  });

  it('does not leak the tenant between concurrent requests', async () => {
    const seen: string[] = [];

    const request = (tenantId: string, delay: number) =>
      service.run(async () => {
        service.set({ tenantId, userId: `user-${tenantId}`, role: Role.STAFF });
        await new Promise((resolve) => setTimeout(resolve, delay));
        seen.push(`${tenantId}:${service.tenantId}`);
      });

    await Promise.all([request('a', 20), request('b', 5), request('c', 10)]);

    expect(seen.sort()).toEqual(['a:a', 'b:b', 'c:c']);
  });

  it('throws when a scoped operation runs with no tenant', () => {
    service.run(() => {
      expect(() => service.requireTenantId('SomeRepository')).toThrow(
        TenantContextMissingError,
      );
    });
  });

  it('throws when a scoped operation runs outside of a request', () => {
    expect(() => service.requireTenantId('SomeRepository')).toThrow(
      TenantContextMissingError,
    );
  });

  it('runWithTenant opens an isolated scope for background work', async () => {
    await service.run(async () => {
      service.set({ tenantId: 'outer', userId: 'user-1', role: Role.OWNER });

      const inner = await service.runWithTenant('inner', () =>
        Promise.resolve(service.tenantId),
      );

      expect(inner).toBe('inner');
      expect(service.tenantId).toBe('outer');
    });
  });
});
