import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { tenants } from './tenant.schema';

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    address: text('address'),
    mapsUrl: text('maps_url'),
    phone: varchar('phone', { length: 20 }),
    weeklyHours: jsonb('weekly_hours').$type<WeeklyHours>().notNull(),
    // Null means inherit Tenant.timezone.
    timezone: varchar('timezone', { length: 64 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('branches_tenant_idx').on(t.tenantId),
    uniqueIndex('branches_tenant_slug_uq').on(t.tenantId, t.slug),
    uniqueIndex('branches_tenant_primary_uq')
      .on(t.tenantId)
      .where(sql`${t.isPrimary} and ${t.isActive}`),
  ],
);

export type BranchSchema = typeof branches.$inferSelect;
