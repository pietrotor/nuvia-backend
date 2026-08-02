import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const roleEnum = pgEnum('role', ['owner', 'staff', 'superadmin']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null only for superadmin, which operates across tenants.
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }),
    password: varchar('password', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('staff'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('user_tenant_idx').on(t.tenantId)],
);

export type UserSchema = typeof users.$inferSelect;
export type NewUserSchema = typeof users.$inferInsert;
