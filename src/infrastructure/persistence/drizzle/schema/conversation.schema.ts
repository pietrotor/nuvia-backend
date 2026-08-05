import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { clients } from './client.schema';

export const messageDirectionEnum = pgEnum('message_direction', [
  'inbound',
  'outbound',
]);

export const messageKindEnum = pgEnum('message_kind', [
  'text',
  'audio',
  'image',
  'other',
]);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'restrict',
    }),
    clientPhoneE164: varchar('client_phone_e164', { length: 20 }).notNull(),
    botPaused: boolean('bot_paused').notNull().default(false),
    botPausedAt: timestamp('bot_paused_at', { withTimezone: true }),
    handoffReason: text('handoff_reason'),
    lastActivityAt: timestamp('last_activity_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('conversations_tenant_idx').on(t.tenantId),
    index('conversations_client_idx').on(t.clientId),
    uniqueIndex('conversations_tenant_phone_uq').on(
      t.tenantId,
      t.clientPhoneE164,
    ),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    providerMessageId: varchar('provider_message_id', {
      length: 255,
    }).notNull(),
    inReplyToProviderMessageId: varchar('in_reply_to_provider_message_id', {
      length: 255,
    }),
    direction: messageDirectionEnum('direction').notNull(),
    kind: messageKindEnum('kind').notNull(),
    content: text('content'),
    promptFingerprint: varchar('prompt_fingerprint', { length: 64 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('messages_tenant_idx').on(t.tenantId),
    index('messages_conversation_occurred_idx').on(
      t.conversationId,
      t.occurredAt,
    ),
    uniqueIndex('messages_tenant_provider_message_uq').on(
      t.tenantId,
      t.providerMessageId,
    ),
    uniqueIndex('messages_tenant_reply_uq')
      .on(t.tenantId, t.inReplyToProviderMessageId)
      .where(sql`${t.inReplyToProviderMessageId} is not null`),
  ],
);

export type ConversationSchema = typeof conversations.$inferSelect;
export type MessageSchema = typeof messages.$inferSelect;
