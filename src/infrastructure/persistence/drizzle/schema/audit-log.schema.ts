import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null for cross-tenant actions and for events logged before auth resolves.
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    entity: varchar('entity', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: varchar('ip', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_log_tenant_idx').on(t.tenantId),
    index('audit_log_entity_idx').on(t.entity, t.entityId),
  ],
);

export type AuditLogSchema = typeof auditLogs.$inferSelect;
export type NewAuditLogSchema = typeof auditLogs.$inferInsert;
