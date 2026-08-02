import { PgDialect } from 'drizzle-orm/pg-core';

import { TenantContextMissingError } from '@domain/common/exceptions';
import { Role } from '@domain/users/value-objects/role.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DrizzleService } from '../drizzle/drizzle.service';
import { users } from '../drizzle/schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

class TestRepository extends TenantScopedRepository {
  readQuery() {
    return this.selectFrom(users);
  }

  scopeCondition() {
    return this.scope(users);
  }
}

describe('TenantScopedRepository', () => {
  let tenantContext: TenantContextService;
  let repository: TestRepository;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    repository = new TestRepository({} as DrizzleService, tenantContext);
  });

  it('refuses to query when there is no tenant in context', () => {
    tenantContext.run(() => {
      expect(() => repository.readQuery()).toThrow(TenantContextMissingError);
    });
  });

  it('names the offending repository so the log points at the bug', () => {
    tenantContext.run(() => {
      expect(() => repository.readQuery()).toThrow(
        expect.objectContaining({ detail: 'TestRepository' }),
      );
    });
  });

  it('always filters by the tenant of the request', () => {
    tenantContext.run(() => {
      tenantContext.set({
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: Role.OWNER,
      });

      const query = new PgDialect().sqlToQuery(repository.scopeCondition());

      expect(query.sql).toContain('"tenant_id"');
      expect(query.params).toContain('tenant-1');
    });
  });
});
