import {
  pgTable,
  uuid,
  timestamp,
  pgEnum,
  index,
  check,
  numeric,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { currencyEnum } from './currency.schema';
import { tenants } from './tenant.schema';
import { clients } from './client.schema';
import { professionals } from './professional.schema';
import { services } from './service.schema';
import { branches } from './branch.schema';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending_deposit',
  'confirmed',
  'attended',
  'no_show',
  'cancelled',
  'released',
]);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull(),
    // Snapshot at booking time: branch price overrides make a live join unsafe.
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum('currency').notNull(),
    depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check('appointments_valid_time_range', sql`${t.endsAt} > ${t.startsAt}`),
    check('appointments_non_negative_price', sql`${t.price} >= 0`),
    check(
      'appointments_positive_deposit_amount',
      sql`${t.depositAmount} is null or ${t.depositAmount} > 0`,
    ),
    index('appointments_tenant_idx').on(t.tenantId),
    index('appointments_branch_starts_idx').on(
      t.tenantId,
      t.branchId,
      t.startsAt,
    ),
    index('appointments_client_idx').on(t.clientId),
    index('appointments_service_idx').on(t.serviceId),
    index('appointments_professional_starts_idx').on(
      t.professionalId,
      t.startsAt,
    ),
    index('appointments_active_slot_idx')
      .on(t.professionalId, t.startsAt, t.endsAt)
      .where(sql`${t.status} in ('pending_deposit', 'confirmed')`),
  ],
);

export type AppointmentSchema = typeof appointments.$inferSelect;
