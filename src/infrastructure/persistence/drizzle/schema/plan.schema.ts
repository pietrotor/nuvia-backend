import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import type { PartialPlanConfig } from '@domain/subscriptions/value-objects/plan-config.vo';

import { currencyEnum } from './currency.schema';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  priceAmount: numeric('price_amount', { precision: 12, scale: 2 }).notNull(),
  priceCurrency: currencyEnum('price_currency').notNull().default('BOB'),
  billingPeriodMonths: integer('billing_period_months').notNull().default(1),
  config: jsonb('config').$type<PartialPlanConfig>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PlanSchema = typeof plans.$inferSelect;
export type NewPlanSchema = typeof plans.$inferInsert;
