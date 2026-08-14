import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
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
    email: varchar('email', { length: 320 }),
    birthDate: date('birth_date'),
    identificationType: varchar('identification_type', { length: 50 }),
    identificationNumber: varchar('identification_number', { length: 100 }),
    address: text('address'),
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
