import { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { SQL, and, eq } from 'drizzle-orm';

import { DrizzleService } from '../drizzle/drizzle.service';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

export type TenantScopedTable = PgTable & { tenantId: PgColumn };

type Condition = SQL | undefined;

// Base class for every repository whose table has tenant_id. The helpers read the
// tenant from the request context and throw when there is none, so a query can
// never silently span tenants.
export abstract class TenantScopedRepository {
  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly tenantContext: TenantContextService,
  ) {}

  protected get tenantId(): string {
    return this.tenantContext.requireTenantId(this.constructor.name);
  }

  // Each helper resolves the scope before touching the connection, so a missing
  // tenant fails before any query exists.
  protected selectFrom<T extends TenantScopedTable>(
    table: T,
    ...conditions: Condition[]
  ) {
    const scope = this.scope(table, ...conditions);

    return this.drizzle.db
      .select()
      .from(table as PgTable)
      .where(scope) as Promise<T['$inferSelect'][]>;
  }

  protected insertInto<T extends TenantScopedTable>(
    table: T,
    values: Omit<T['$inferInsert'], 'tenantId'>,
  ) {
    const tenantId = this.tenantId;

    return this.drizzle.db
      .insert(table as PgTable)
      .values({ ...values, tenantId })
      .returning() as Promise<T['$inferSelect'][]>;
  }

  protected updateIn<T extends TenantScopedTable>(
    table: T,
    values: Partial<T['$inferInsert']>,
    ...conditions: Condition[]
  ) {
    const scope = this.scope(table, ...conditions);

    return this.drizzle.db
      .update(table as PgTable)
      .set(values)
      .where(scope)
      .returning() as Promise<T['$inferSelect'][]>;
  }

  protected deleteFrom<T extends TenantScopedTable>(
    table: T,
    ...conditions: Condition[]
  ) {
    const scope = this.scope(table, ...conditions);

    return this.drizzle.db.delete(table as PgTable).where(scope);
  }

  // Escape hatch for queries the helpers cannot express (joins, aggregates).
  // The result still has to be filtered by this condition.
  protected scope(table: TenantScopedTable, ...conditions: Condition[]): SQL {
    // and() is only undefined when every condition is, and the tenant one never is.
    return and(eq(table.tenantId, this.tenantId), ...conditions) as SQL;
  }
}
