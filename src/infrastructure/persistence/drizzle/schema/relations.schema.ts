import { relations } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { businessConfigs } from './business-config.schema';
import { professionals } from './professional.schema';
import { services, professionalServices } from './service.schema';
import { depositQrs } from './deposit.schema';
import { clients } from './client.schema';
import { scheduleBlocks } from './schedule-block.schema';
import { appointments } from './appointment.schema';
import { conversations, messages } from './conversation.schema';
import { branches } from './branch.schema';
import {
  branchProfessionals,
  branchProfessionalServiceWindows,
  branchServices,
  userBranches,
} from './branch-assignment.schema';
import { users } from './user.schema';
import { plans } from './plan.schema';
import { subscriptions } from './subscription.schema';

export const tenantRelations = relations(tenants, ({ one, many }) => ({
  businessConfig: one(businessConfigs),
  branches: many(branches),
  professionals: many(professionals),
  services: many(services),
  professionalServices: many(professionalServices),
  depositQrs: many(depositQrs),
  clients: many(clients),
  scheduleBlocks: many(scheduleBlocks),
  appointments: many(appointments),
  conversations: many(conversations),
  messages: many(messages),
  subscriptions: many(subscriptions),
}));

export const businessConfigRelations = relations(
  businessConfigs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [businessConfigs.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const branchRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [branches.tenantId],
    references: [tenants.id],
  }),
  professionals: many(branchProfessionals),
  services: many(branchServices),
  serviceWindows: many(branchProfessionalServiceWindows),
  userBranches: many(userBranches),
  appointments: many(appointments),
  scheduleBlocks: many(scheduleBlocks),
  depositQrs: many(depositQrs),
  conversations: many(conversations),
}));

export const branchProfessionalRelations = relations(
  branchProfessionals,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [branchProfessionals.tenantId],
      references: [tenants.id],
    }),
    branch: one(branches, {
      fields: [branchProfessionals.branchId],
      references: [branches.id],
    }),
    professional: one(professionals, {
      fields: [branchProfessionals.professionalId],
      references: [professionals.id],
    }),
  }),
);

export const branchServiceRelations = relations(branchServices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [branchServices.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [branchServices.branchId],
    references: [branches.id],
  }),
  service: one(services, {
    fields: [branchServices.serviceId],
    references: [services.id],
  }),
  depositQr: one(depositQrs, {
    fields: [branchServices.depositQrId],
    references: [depositQrs.id],
  }),
}));

export const branchProfessionalServiceWindowRelations = relations(
  branchProfessionalServiceWindows,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [branchProfessionalServiceWindows.tenantId],
      references: [tenants.id],
    }),
    branch: one(branches, {
      fields: [branchProfessionalServiceWindows.branchId],
      references: [branches.id],
    }),
    professional: one(professionals, {
      fields: [branchProfessionalServiceWindows.professionalId],
      references: [professionals.id],
    }),
    service: one(services, {
      fields: [branchProfessionalServiceWindows.serviceId],
      references: [services.id],
    }),
  }),
);

export const userBranchRelations = relations(userBranches, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userBranches.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userBranches.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [userBranches.branchId],
    references: [branches.id],
  }),
}));

export const professionalRelations = relations(
  professionals,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [professionals.tenantId],
      references: [tenants.id],
    }),
    services: many(professionalServices),
    branchAssignments: many(branchProfessionals),
    scheduleBlocks: many(scheduleBlocks),
    appointments: many(appointments),
  }),
);

export const serviceRelations = relations(services, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [services.tenantId],
    references: [tenants.id],
  }),
  depositQr: one(depositQrs, {
    fields: [services.depositQrId],
    references: [depositQrs.id],
  }),
  professionals: many(professionalServices),
  branchOffers: many(branchServices),
  appointments: many(appointments),
}));

export const depositQrRelations = relations(depositQrs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [depositQrs.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [depositQrs.branchId],
    references: [branches.id],
  }),
  services: many(services),
  branchServices: many(branchServices),
}));

export const professionalServiceRelations = relations(
  professionalServices,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [professionalServices.tenantId],
      references: [tenants.id],
    }),
    professional: one(professionals, {
      fields: [professionalServices.professionalId],
      references: [professionals.id],
    }),
    service: one(services, {
      fields: [professionalServices.serviceId],
      references: [services.id],
    }),
  }),
);

export const clientRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  appointments: many(appointments),
  conversations: many(conversations),
}));

export const scheduleBlockRelations = relations(scheduleBlocks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [scheduleBlocks.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [scheduleBlocks.branchId],
    references: [branches.id],
  }),
  professional: one(professionals, {
    fields: [scheduleBlocks.professionalId],
    references: [professionals.id],
  }),
}));

export const appointmentRelations = relations(appointments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [appointments.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [appointments.branchId],
    references: [branches.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
    relationName: 'appointmentAttendee',
  }),
  bookingContact: one(clients, {
    fields: [appointments.bookingContactClientId],
    references: [clients.id],
    relationName: 'appointmentBookingContact',
  }),
  professional: one(professionals, {
    fields: [appointments.professionalId],
    references: [professionals.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
}));

export const conversationRelations = relations(
  conversations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [conversations.tenantId],
      references: [tenants.id],
    }),
    client: one(clients, {
      fields: [conversations.clientId],
      references: [clients.id],
    }),
    branch: one(branches, {
      fields: [conversations.branchId],
      references: [branches.id],
    }),
    messages: many(messages),
  }),
);

export const messageRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const planRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));
