import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { tenants } from './tenant.schema';
import { branches } from './branch.schema';
import { professionals } from './professional.schema';
import { services } from './service.schema';
import { depositQrs } from './deposit.schema';
import { users } from './user.schema';

export const branchProfessionals = pgTable(
  'branch_professionals',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    // The only source of truth for when a professional works at this branch.
    weeklyHours: jsonb('weekly_hours').$type<WeeklyHours>().notNull(),
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
    primaryKey({ columns: [t.professionalId, t.branchId] }),
    index('branch_professionals_tenant_idx').on(t.tenantId),
    index('branch_professionals_branch_idx').on(t.branchId),
  ],
);

export const branchServices = pgTable(
  'branch_services',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    // Null means inherit from the tenant catalog service.
    priceOverride: numeric('price_override', { precision: 12, scale: 2 }),
    depositAmountOverride: numeric('deposit_amount_override', {
      precision: 12,
      scale: 2,
    }),
    depositQrId: uuid('deposit_qr_id').references(() => depositQrs.id, {
      onDelete: 'set null',
    }),
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
    primaryKey({ columns: [t.branchId, t.serviceId] }),
    index('branch_services_tenant_idx').on(t.tenantId),
    index('branch_services_service_idx').on(t.serviceId),
  ],
);

// Optional: when this professional offers this service at this branch.
// No row = inherit full BranchProfessional ∩ Branch hours.
export const branchProfessionalServiceWindows = pgTable(
  'branch_professional_service_windows',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    weeklyHours: jsonb('weekly_hours').$type<WeeklyHours>().notNull(),
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
    primaryKey({
      columns: [t.branchId, t.professionalId, t.serviceId],
    }),
    index('branch_professional_service_windows_tenant_idx').on(t.tenantId),
    index('branch_professional_service_windows_professional_idx').on(
      t.professionalId,
    ),
    index('branch_professional_service_windows_service_idx').on(t.serviceId),
  ],
);

export const userBranches = pgTable(
  'user_branches',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.branchId] }),
    index('user_branches_tenant_idx').on(t.tenantId),
    index('user_branches_branch_idx').on(t.branchId),
  ],
);

export type BranchProfessionalSchema = typeof branchProfessionals.$inferSelect;
export type BranchServiceSchema = typeof branchServices.$inferSelect;
export type BranchProfessionalServiceWindowSchema =
  typeof branchProfessionalServiceWindows.$inferSelect;
export type UserBranchSchema = typeof userBranches.$inferSelect;
