import {
  check,
  foreignKey,
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
import { professionals } from './professional.schema';
import { branches } from './branch.schema';
import { appointments } from './appointment.schema';

export const notificationContactStatusEnum = pgEnum(
  'notification_contact_status',
  ['pending', 'active', 'paused', 'deactivated'],
);

export const appointmentNotificationKindEnum = pgEnum(
  'appointment_notification_kind',
  ['booked', 'rescheduled', 'cancelled'],
);

export const appointmentNotificationDeliveryStatusEnum = pgEnum(
  'appointment_notification_delivery_status',
  [
    'pending',
    'deferred',
    'dispatching',
    'accepted',
    'delivered',
    'failed',
    'unknown',
    'suppressed',
  ],
);

export const notificationContacts = pgTable(
  'notification_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    phoneE164: varchar('phone_e164', { length: 20 }).notNull(),
    status: notificationContactStatusEnum('status')
      .notNull()
      .default('pending'),
    activationCodeHash: varchar('activation_code_hash', { length: 64 }),
    activationExpiresAt: timestamp('activation_expires_at', {
      withTimezone: true,
    }),
    activationProviderMessageId: varchar('activation_provider_message_id', {
      length: 255,
    }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('notification_contacts_tenant_id_uq').on(t.tenantId, t.id),
    uniqueIndex('notification_contacts_tenant_phone_uq').on(
      t.tenantId,
      t.phoneE164,
    ),
    index('notification_contacts_tenant_status_idx')
      .on(t.tenantId, t.status)
      .where(sql`${t.status} in ('pending', 'active', 'paused')`),
  ],
);

export const appointmentNotificationSubscriptions = pgTable(
  'appointment_notification_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => notificationContacts.id, { onDelete: 'restrict' }),
    professionalId: uuid('professional_id').references(() => professionals.id, {
      onDelete: 'restrict',
    }),
    branchId: uuid('branch_id').references(() => branches.id, {
      onDelete: 'restrict',
    }),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('appointment_notification_subscriptions_tenant_id_uq').on(
      t.tenantId,
      t.id,
    ),
    foreignKey({
      name: 'appointment_notification_subscriptions_contact_fk',
      columns: [t.tenantId, t.contactId],
      foreignColumns: [notificationContacts.tenantId, notificationContacts.id],
    }).onDelete('restrict'),
    check(
      'appointment_notification_subscriptions_one_scope',
      sql`num_nonnulls(${t.professionalId}, ${t.branchId}) = 1`,
    ),
    uniqueIndex('appointment_notification_subscriptions_professional_uq')
      .on(t.tenantId, t.contactId, t.professionalId)
      .where(sql`${t.professionalId} is not null`),
    uniqueIndex('appointment_notification_subscriptions_branch_uq')
      .on(t.tenantId, t.contactId, t.branchId)
      .where(sql`${t.branchId} is not null`),
    uniqueIndex('appointment_notification_subscriptions_professional_active_uq')
      .on(t.tenantId, t.professionalId)
      .where(sql`${t.professionalId} is not null and ${t.disabledAt} is null`),
    index('appointment_notification_subscriptions_professional_idx')
      .on(t.tenantId, t.professionalId)
      .where(sql`${t.disabledAt} is null`),
    index('appointment_notification_subscriptions_branch_idx')
      .on(t.tenantId, t.branchId)
      .where(sql`${t.disabledAt} is null`),
  ],
);

export const appointmentNotificationEvents = pgTable(
  'appointment_notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    sequence: integer('sequence').notNull(),
    kind: appointmentNotificationKindEnum('kind').notNull(),
    previousProfessionalId: uuid('previous_professional_id'),
    previousBranchId: uuid('previous_branch_id'),
    previousStartsAt: timestamp('previous_starts_at', { withTimezone: true }),
    previousEndsAt: timestamp('previous_ends_at', { withTimezone: true }),
    currentProfessionalId: uuid('current_professional_id').notNull(),
    currentBranchId: uuid('current_branch_id').notNull(),
    currentStartsAt: timestamp('current_starts_at', {
      withTimezone: true,
    }).notNull(),
    currentEndsAt: timestamp('current_ends_at', {
      withTimezone: true,
    }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    expandedAt: timestamp('expanded_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
    }).notNull(),
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
    uniqueIndex('appointment_notification_events_tenant_id_uq').on(
      t.tenantId,
      t.id,
    ),
    uniqueIndex('appointment_notification_events_sequence_uq').on(
      t.tenantId,
      t.appointmentId,
      t.sequence,
    ),
    index('appointment_notification_events_unexpanded_idx')
      .on(t.tenantId, t.nextAttemptAt)
      .where(sql`${t.expandedAt} is null`),
    index('appointment_notification_events_unexpanded_unscoped_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.expandedAt} is null`),
    index('appointment_notification_events_appointment_idx').on(
      t.tenantId,
      t.appointmentId,
      t.occurredAt,
    ),
  ],
);

export const appointmentNotificationDeliveries = pgTable(
  'appointment_notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => appointmentNotificationEvents.id, {
        onDelete: 'restrict',
      }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => notificationContacts.id, { onDelete: 'restrict' }),
    destinationPhoneE164: varchar('destination_phone_e164', {
      length: 20,
    }).notNull(),
    renderedContent: text('rendered_content'),
    status: appointmentNotificationDeliveryStatusEnum('status')
      .notNull()
      .default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
    }).notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
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
    uniqueIndex('appointment_notification_deliveries_tenant_id_uq').on(
      t.tenantId,
      t.id,
    ),
    foreignKey({
      name: 'appointment_notification_deliveries_event_fk',
      columns: [t.tenantId, t.eventId],
      foreignColumns: [
        appointmentNotificationEvents.tenantId,
        appointmentNotificationEvents.id,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'appointment_notification_deliveries_contact_fk',
      columns: [t.tenantId, t.contactId],
      foreignColumns: [notificationContacts.tenantId, notificationContacts.id],
    }).onDelete('restrict'),
    uniqueIndex('appointment_notification_deliveries_event_contact_uq').on(
      t.tenantId,
      t.eventId,
      t.contactId,
    ),
    uniqueIndex('appointment_notification_deliveries_provider_uq')
      .on(t.tenantId, t.providerMessageId)
      .where(sql`${t.providerMessageId} is not null`),
    index('appointment_notification_deliveries_due_idx')
      .on(t.tenantId, t.status, t.nextAttemptAt)
      .where(sql`${t.status} in ('pending', 'deferred')`),
    index('appointment_notification_deliveries_due_unscoped_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} in ('pending', 'deferred')`),
    index('appointment_notification_deliveries_lease_unscoped_idx')
      .on(t.leaseUntil)
      .where(sql`${t.status} = 'dispatching'`),
    index('appointment_notification_deliveries_contact_idx').on(
      t.tenantId,
      t.contactId,
    ),
  ],
);

export type NotificationContactSchema =
  typeof notificationContacts.$inferSelect;
export type AppointmentNotificationSubscriptionSchema =
  typeof appointmentNotificationSubscriptions.$inferSelect;
export type AppointmentNotificationEventSchema =
  typeof appointmentNotificationEvents.$inferSelect;
export type AppointmentNotificationDeliverySchema =
  typeof appointmentNotificationDeliveries.$inferSelect;
