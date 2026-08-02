import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { SendWindowConfig } from '@domain/tenants/value-objects/send-window-config.vo';

export const verticalEnum = pgEnum('vertical', [
  'academy',
  'daycare',
  'gym',
  'other',
]);

export const tenantStatusEnum = pgEnum('tenant_status', [
  'trial',
  'active',
  'suspended',
]);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  vertical: verticalEnum('vertical').notNull().default('other'),
  verticalTemplateId: uuid('vertical_template_id'),
  timezone: varchar('timezone', { length: 64 })
    .notNull()
    .default('America/La_Paz'),
  sendWindowConfig: jsonb('send_window_config').$type<SendWindowConfig>(),
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  status: tenantStatusEnum('status').notNull().default('trial'),
  plan: varchar('plan', { length: 50 }),
  staticQrUrl: text('static_qr_url'),
  paymentsEmail: varchar('payments_email', { length: 255 }).unique(),
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
