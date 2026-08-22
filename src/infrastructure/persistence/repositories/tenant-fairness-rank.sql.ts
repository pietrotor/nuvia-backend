import { SQL, sql } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

export function tenantFairnessRankSql(
  tenantId: PgColumn,
  nextAttemptAt: PgColumn,
  id: PgColumn,
): SQL<number> {
  return sql<number>`row_number() over (partition by ${tenantId} order by ${nextAttemptAt} asc, ${id} asc)`;
}
