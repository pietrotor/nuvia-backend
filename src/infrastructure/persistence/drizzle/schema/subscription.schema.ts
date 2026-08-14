import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { PartialPlanConfig } from '@domain/subscriptions/value-objects/plan-config.vo';

import { currencyEnum } from './currency.schema';
import { plans } from './plan.schema';
import { tenants } from './tenant.schema';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    status: subscriptionStatusEnum('status').notNull().default('trialing'),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
    }).notNull(),
    configOverrides: jsonb('config_overrides').$type<PartialPlanConfig>(),
    priceAmount: numeric('price_amount', { precision: 12, scale: 2 }).notNull(),
    priceCurrency: currencyEnum('price_currency').notNull().default('BOB'),
    notes: text('notes'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('subscriptions_tenant_idx').on(t.tenantId),
    uniqueIndex('subscriptions_tenant_active_uq')
      .on(t.tenantId)
      .where(sql`${t.status} <> 'cancelled'`),
  ],
);

export type SubscriptionSchema = typeof subscriptions.$inferSelect;
export type NewSubscriptionSchema = typeof subscriptions.$inferInsert;
