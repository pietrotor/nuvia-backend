import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  AgentTone,
  AgentPolicy,
  BookingPolicy,
} from '@domain/business-config/entities/business-config.entity';
import { ClientReminderPolicy } from '@domain/business-config/value-objects/client-reminder-policy.vo';

import { currencyEnum } from './currency.schema';
import { tenants } from './tenant.schema';

export const agentToneEnum = pgEnum('agent_tone', ['formal', 'warm']);

export const businessCategoryEnum = pgEnum('business_category', [
  'default',
  'esthetics',
  'spa',
  'beauty',
  'medical',
]);

export const businessConfigs = pgTable(
  'business_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    agentName: varchar('agent_name', { length: 100 }).notNull().default('Vale'),
    tone: agentToneEnum('tone').notNull().default('warm'),
    businessCategory: businessCategoryEnum('business_category')
      .notNull()
      .default('default'),
    currency: currencyEnum('currency').notNull().default('BOB'),
    countryCode: varchar('country_code', { length: 2 }).notNull().default('BO'),
    logoUrl: text('logo_url'),
    whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
    bookingPolicy: jsonb('booking_policy').$type<BookingPolicy>().notNull(),
    agentPolicy: jsonb('agent_policy').$type<AgentPolicy>().notNull(),
    clientReminderPolicy: jsonb('client_reminder_policy')
      .$type<ClientReminderPolicy>()
      .notNull(),
    faq: jsonb('faq').$type<Record<string, string>>().notNull().default({}),
    evolutionInstanceId: varchar('evolution_instance_id', { length: 255 }),
    evolutionInstanceName: varchar('evolution_instance_name', { length: 255 }),
    evolutionWebhookTokenHash: varchar('evolution_webhook_token_hash', {
      length: 64,
    }),
    evolutionHumanLabelId: varchar('evolution_human_label_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('business_configs_tenant_uq').on(t.tenantId),
    uniqueIndex('business_configs_slug_uq').on(t.slug),
    uniqueIndex('business_configs_evolution_instance_name_uq')
      .on(t.evolutionInstanceName)
      .where(sql`${t.evolutionInstanceName} is not null`),
  ],
);

export type BusinessConfigSchema = typeof businessConfigs.$inferSelect;
export type NewBusinessConfigSchema = typeof businessConfigs.$inferInsert;

export { AgentTone };
