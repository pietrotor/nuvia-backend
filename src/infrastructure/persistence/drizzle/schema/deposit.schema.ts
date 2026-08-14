import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { branches } from './branch.schema';

export const depositQrs = pgTable(
  'deposit_qrs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Null = tenant-wide QR; a value scopes the QR (and its default) to a branch.
    branchId: uuid('branch_id').references(() => branches.id, {
      onDelete: 'cascade',
    }),
    label: varchar('label', { length: 100 }).notNull(),
    // Key of the ObjectStoragePort, never a provider URL: persisting an S3 URL
    // would turn a change of storage provider into a data migration.
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
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
    check('deposit_qrs_positive_size', sql`${t.sizeBytes} > 0`),
    index('deposit_qrs_tenant_idx').on(t.tenantId),
    index('deposit_qrs_branch_idx').on(t.branchId),
    // One tenant-wide default (branch_id null) and one default per branch.
    uniqueIndex('deposit_qrs_tenant_default_uq')
      .on(t.tenantId)
      .where(sql`${t.isDefault} and ${t.isActive} and ${t.branchId} is null`),
    uniqueIndex('deposit_qrs_branch_default_uq')
      .on(t.tenantId, t.branchId)
      .where(
        sql`${t.isDefault} and ${t.isActive} and ${t.branchId} is not null`,
      ),
    uniqueIndex('deposit_qrs_label_uq')
      .on(t.tenantId, t.label)
      .where(sql`${t.isActive}`),
  ],
);

export type DepositQrSchema = typeof depositQrs.$inferSelect;
