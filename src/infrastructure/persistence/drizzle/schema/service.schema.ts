import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { currencyEnum } from './currency.schema';
import { tenants } from './tenant.schema';
import { professionals } from './professional.schema';
import { depositQrs } from './deposit.schema';

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    // No default: the currency of a price is resolved from the business config when
    // the service is created, so a row can never carry an amount without it.
    currency: currencyEnum('currency').notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    requiresDeposit: boolean('requires_deposit').notNull().default(false),
    depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }),
    depositPercent: integer('deposit_percent'),
    // Null means "use the QR the business marked as default"; a value is only for
    // services charged to a different account.
    depositQrId: uuid('deposit_qr_id').references(() => depositQrs.id, {
      onDelete: 'set null',
    }),
    // Whether the agent offers the client a professional to pick. False for services where
    // whoever is free will do, so it can go straight to the earliest slot.
    clientChoosesProfessional: boolean('client_chooses_professional')
      .notNull()
      .default(true),
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
    check('services_positive_duration', sql`${t.durationMinutes} > 0`),
    check('services_non_negative_price', sql`${t.price} >= 0`),
    check(
      'services_valid_deposit_percent',
      sql`${t.depositPercent} is null or (${t.depositPercent} between 1 and 100)`,
    ),
    check(
      'services_positive_deposit_amount',
      sql`${t.depositAmount} is null or ${t.depositAmount} > 0`,
    ),
    check(
      'services_deposit_configuration',
      sql`(
        (${t.requiresDeposit} = false and ${t.depositAmount} is null and ${t.depositPercent} is null)
        or
        (${t.requiresDeposit} = true and num_nonnulls(${t.depositAmount}, ${t.depositPercent}) = 1)
      )`,
    ),
    check(
      'services_deposit_qr_requires_deposit',
      sql`${t.depositQrId} is null or ${t.requiresDeposit} = true`,
    ),
    index('services_tenant_idx').on(t.tenantId),
  ],
);

export const professionalServices = pgTable(
  'professional_services',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.professionalId, t.serviceId] }),
    index('professional_services_tenant_idx').on(t.tenantId),
    index('professional_services_service_idx').on(t.serviceId),
  ],
);

export type ServiceSchema = typeof services.$inferSelect;
