import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    phoneE164: varchar('phone_e164', { length: 20 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('clients_tenant_idx').on(t.tenantId),
    uniqueIndex('clients_tenant_phone_uq').on(t.tenantId, t.phoneE164),
  ],
);

export type ClientSchema = typeof clients.$inferSelect;
