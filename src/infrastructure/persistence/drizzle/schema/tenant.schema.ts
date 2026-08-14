import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'trial',
  'active',
  'suspended',
]);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 64 })
    .notNull()
    .default('America/La_Paz'),
  status: tenantStatusEnum('status').notNull().default('trial'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TenantSchema = typeof tenants.$inferSelect;
export type NewTenantSchema = typeof tenants.$inferInsert;
