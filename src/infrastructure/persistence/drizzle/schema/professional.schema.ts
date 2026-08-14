import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const professionals = pgTable(
  'professionals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    // ObjectStoragePort key. The panel downloads via GET /professionals/:id/avatar,
    // so a provider URL never lands in the database.
    avatarStorageKey: text('avatar_storage_key'),
    avatarMimeType: varchar('avatar_mime_type', { length: 100 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('professionals_tenant_idx').on(t.tenantId)],
);

export type ProfessionalSchema = typeof professionals.$inferSelect;
