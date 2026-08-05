import { relations } from 'drizzle-orm';

import { tenants } from './tenant.schema';
import { businessConfigs } from './business-config.schema';
import { professionals } from './professional.schema';
import { services, professionalServices } from './service.schema';
import { clients } from './client.schema';
import { scheduleBlocks } from './schedule-block.schema';
import { appointments } from './appointment.schema';
import { conversations, messages } from './conversation.schema';

export const tenantRelations = relations(tenants, ({ one, many }) => ({
  businessConfig: one(businessConfigs),
  professionals: many(professionals),
  services: many(services),
  professionalServices: many(professionalServices),
  clients: many(clients),
  scheduleBlocks: many(scheduleBlocks),
  appointments: many(appointments),
  conversations: many(conversations),
  messages: many(messages),
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

export const professionalRelations = relations(
  professionals,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [professionals.tenantId],
      references: [tenants.id],
    }),
    services: many(professionalServices),
    scheduleBlocks: many(scheduleBlocks),
    appointments: many(appointments),
  }),
);

export const serviceRelations = relations(services, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [services.tenantId],
    references: [tenants.id],
  }),
  professionals: many(professionalServices),
  appointments: many(appointments),
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
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
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
