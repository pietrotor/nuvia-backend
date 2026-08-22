import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { appointments } from './appointment.schema';
import { clients } from './client.schema';
import { conversations } from './conversation.schema';
import { tenants } from './tenant.schema';

export const depositReceiptStatusEnum = pgEnum('deposit_receipt_status', [
  'pending_assignment',
  'assigned',
  'superseded',
]);

export const depositReceiptSourceEnum = pgEnum('deposit_receipt_source', [
  'whatsapp',
  'staff',
]);

export const depositReceiptClassificationEnum = pgEnum(
  'deposit_receipt_classification',
  ['receipt', 'unknown', 'staff_upload'],
);

export const depositReceiptExpectationStatusEnum = pgEnum(
  'deposit_receipt_expectation_status',
  ['active', 'consumed', 'expired'],
);

export const depositReceipts = pgTable(
  'deposit_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'restrict',
    }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'restrict',
    }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    status: depositReceiptStatusEnum('status').notNull(),
    source: depositReceiptSourceEnum('source').notNull(),
    classification:
      depositReceiptClassificationEnum('classification').notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      'deposit_receipts_assignment_consistency',
      sql`(${t.status} = 'pending_assignment' and ${t.appointmentId} is null and ${t.supersededAt} is null)
        or (${t.status} = 'assigned' and ${t.appointmentId} is not null and ${t.supersededAt} is null)
        or (${t.status} = 'superseded' and ${t.appointmentId} is not null and ${t.supersededAt} is not null)`,
    ),
    index('deposit_receipts_tenant_idx').on(t.tenantId),
    index('deposit_receipts_conversation_received_idx').on(
      t.tenantId,
      t.conversationId,
      t.receivedAt,
    ),
    index('deposit_receipts_client_received_idx').on(
      t.tenantId,
      t.clientId,
      t.receivedAt,
    ),
    index('deposit_receipts_appointment_idx').on(t.tenantId, t.appointmentId),
    uniqueIndex('deposit_receipts_provider_message_uq')
      .on(t.tenantId, t.providerMessageId)
      .where(sql`${t.providerMessageId} is not null`),
    uniqueIndex('deposit_receipts_active_appointment_uq')
      .on(t.tenantId, t.appointmentId)
      .where(sql`${t.status} = 'assigned' and ${t.appointmentId} is not null`),
  ],
);

export type DepositReceiptSchema = typeof depositReceipts.$inferSelect;

export const depositReceiptExpectations = pgTable(
  'deposit_receipt_expectations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    status: depositReceiptExpectationStatusEnum('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('deposit_receipt_expectations_tenant_idx').on(t.tenantId),
    index('deposit_receipt_expectations_conversation_idx').on(
      t.tenantId,
      t.conversationId,
    ),
    uniqueIndex('deposit_receipt_expectations_active_conversation_uq')
      .on(t.tenantId, t.conversationId)
      .where(sql`${t.status} = 'active'`),
  ],
);

export type DepositReceiptExpectationSchema =
  typeof depositReceiptExpectations.$inferSelect;
