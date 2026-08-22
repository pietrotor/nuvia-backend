import { PgDialect } from 'drizzle-orm/pg-core';

import { NOTIFICATION_DISPATCH_PER_TENANT_CAP } from '@domain/appointment-notifications/services/notification-limits';
import { appointmentNotificationDeliveries } from '../drizzle/schema/appointment-notification.schema';
import { tenantFairnessRankSql } from './tenant-fairness-rank.sql';

describe('tenantFairnessRankSql', () => {
  it('ranks due rows per tenant without locking', () => {
    const table = appointmentNotificationDeliveries;
    const query = new PgDialect().sqlToQuery(
      tenantFairnessRankSql(table.tenantId, table.nextAttemptAt, table.id),
    );

    expect(query.sql).toContain('row_number()');
    expect(query.sql).toContain('partition by');
    expect(query.sql).not.toMatch(/for update/i);
    expect(NOTIFICATION_DISPATCH_PER_TENANT_CAP).toBe(1);
  });
});
