import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { tenants } from './tenant.schema';

export const professionals = pgTable(
  'professionals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    weeklyHours: jsonb('weekly_hours').$type<WeeklyHours>().notNull(),
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
