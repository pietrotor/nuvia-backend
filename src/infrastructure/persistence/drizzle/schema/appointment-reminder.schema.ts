import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { appointments } from './appointment.schema';

export const appointmentReminderKindEnum = pgEnum('appointment_reminder_kind', [
  '24h',
  '12h',
  '2h',
  '30m',
  'thank_you',
]);

export const appointmentReminderStatusEnum = pgEnum(
  'appointment_reminder_status',
  [
    'pending',
    'deferred',
    'dispatching',
    'accepted',
    'failed',
    'unknown',
    'suppressed',
    'cancelled',
  ],
);

export const appointmentReminders = pgTable(
  'appointment_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    kind: appointmentReminderKindEnum('kind').notNull(),
    destinationPhoneE164: varchar('destination_phone_e164', {
      length: 20,
    }).notNull(),
    renderedContent: text('rendered_content'),
    status: appointmentReminderStatusEnum('status')
      .notNull()
      .default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
    }).notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('appointment_reminders_tenant_id_uq').on(t.tenantId, t.id),
    uniqueIndex('appointment_reminders_appointment_kind_uq').on(
      t.tenantId,
      t.appointmentId,
      t.kind,
    ),
    uniqueIndex('appointment_reminders_provider_uq')
      .on(t.tenantId, t.providerMessageId)
      .where(sql`${t.providerMessageId} is not null`),
    index('appointment_reminders_due_idx')
      .on(t.tenantId, t.status, t.nextAttemptAt)
      .where(sql`${t.status} in ('pending', 'deferred')`),
    index('appointment_reminders_due_unscoped_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} in ('pending', 'deferred')`),
    index('appointment_reminders_lease_unscoped_idx')
      .on(t.leaseUntil)
      .where(sql`${t.status} = 'dispatching'`),
  ],
);

export type AppointmentReminderSchema =
  typeof appointmentReminders.$inferSelect;
