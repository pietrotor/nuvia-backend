import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  check,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { professionals } from './professional.schema';

export const scheduleBlocks = pgTable(
  'schedule_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    professionalId: uuid('professional_id').references(() => professionals.id, {
      onDelete: 'cascade',
    }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
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
    check('schedule_blocks_valid_time_range', sql`${t.endsAt} > ${t.startsAt}`),
    index('schedule_blocks_tenant_idx').on(t.tenantId),
    index('schedule_blocks_professional_starts_idx').on(
      t.professionalId,
      t.startsAt,
    ),
  ],
);

export type ScheduleBlockSchema = typeof scheduleBlocks.$inferSelect;
