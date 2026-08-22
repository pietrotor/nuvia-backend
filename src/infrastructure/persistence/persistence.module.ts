import { Global, Module } from '@nestjs/common';

import { TENANT_REPOSITORY } from '@domain/tenants/repositories/tenant.repository';
import { USER_REPOSITORY } from '@domain/users/repositories/user.repository';
import { AUDIT_LOG_REPOSITORY } from '@domain/audit/repositories/audit-log.repository';
import { BUSINESS_CONFIG_REPOSITORY } from '@domain/business-config/repositories/business-config.repository';
import { BRANCH_REPOSITORY } from '@domain/branches/repositories/branch.repository';
import { BRANCH_PROFESSIONAL_REPOSITORY } from '@domain/branches/repositories/branch-professional.repository';
import { BRANCH_SERVICE_REPOSITORY } from '@domain/branches/repositories/branch-service.repository';
import { BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY } from '@domain/branches/repositories/branch-professional-service-window.repository';
import { USER_BRANCH_REPOSITORY } from '@domain/branches/repositories/user-branch.repository';
import { PROFESSIONAL_REPOSITORY } from '@domain/professionals/repositories/professional.repository';
import { SERVICE_REPOSITORY } from '@domain/services/repositories/service.repository';
import { DEPOSIT_QR_REPOSITORY } from '@domain/deposits/repositories/deposit-qr.repository';
import { DEPOSIT_RECEIPT_REPOSITORY } from '@domain/deposits/repositories/deposit-receipt.repository';
import { CLIENT_REPOSITORY } from '@domain/clients/repositories/client.repository';
import { SCHEDULE_BLOCK_REPOSITORY } from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { APPOINTMENT_REPOSITORY } from '@domain/appointments/repositories/appointment.repository';
import { APPOINTMENT_VIEW_REPOSITORY } from '@domain/appointments/repositories/appointment-view.repository';
import { CONVERSATION_REPOSITORY } from '@domain/conversations/repositories/conversation.repository';
import { CONVERSATION_VIEW_REPOSITORY } from '@domain/conversations/repositories/conversation-view.repository';
import { MESSAGE_REPOSITORY } from '@domain/conversations/repositories/message.repository';
import { SCHEDULE_BLOCK_VIEW_REPOSITORY } from '@domain/schedule-blocks/repositories/schedule-block-view.repository';
import { PLAN_REPOSITORY } from '@domain/subscriptions/repositories/plan.repository';
import { SUBSCRIPTION_REPOSITORY } from '@domain/subscriptions/repositories/subscription.repository';
import { AGENT_USAGE_VIEW_REPOSITORY } from '@domain/subscriptions/repositories/agent-usage.view-repository';
import { PLAN_USAGE_VIEW_REPOSITORY } from '@domain/subscriptions/repositories/plan-usage.view-repository';
import { AGENT_TRACE_REPOSITORY } from '@domain/agent/repositories/agent-trace.repository';
import { AGENT_TRACE_VIEW_REPOSITORY } from '@domain/agent/repositories/agent-trace-view.repository';
import { NOTIFICATION_CONTACT_REPOSITORY } from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY } from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY } from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY } from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { APPOINTMENT_REMINDER_REPOSITORY } from '@domain/reminders/repositories/appointment-reminder.repository';
import { TRANSACTION_PORT } from '@domain/common/ports/transaction.port';

import { DrizzleTenantRepository } from './repositories/tenant.repository.impl';
import { DrizzleUserRepository } from './repositories/user.repository.impl';
import { DrizzleAuditLogRepository } from './repositories/audit-log.repository.impl';
import { DrizzleBusinessConfigRepository } from './repositories/business-config.repository.impl';
import { DrizzleBranchRepository } from './repositories/branch.repository.impl';
import { DrizzleBranchProfessionalRepository } from './repositories/branch-professional.repository.impl';
import { DrizzleBranchServiceRepository } from './repositories/branch-service.repository.impl';
import { DrizzleBranchProfessionalServiceWindowRepository } from './repositories/branch-professional-service-window.repository.impl';
import { DrizzleUserBranchRepository } from './repositories/user-branch.repository.impl';
import { DrizzleProfessionalRepository } from './repositories/professional.repository.impl';
import { DrizzleServiceRepository } from './repositories/service.repository.impl';
import { DrizzleDepositQrRepository } from './repositories/deposit-qr.repository.impl';
import { DrizzleDepositReceiptRepository } from './repositories/deposit-receipt.repository.impl';
import { DrizzleClientRepository } from './repositories/client.repository.impl';
import { DrizzleScheduleBlockRepository } from './repositories/schedule-block.repository.impl';
import { DrizzleAppointmentRepository } from './repositories/appointment.repository.impl';
import { DrizzleAppointmentViewRepository } from './repositories/appointment-view.repository.impl';
import { DrizzleConversationRepository } from './repositories/conversation.repository.impl';
import { DrizzleConversationViewRepository } from './repositories/conversation-view.repository.impl';
import { DrizzleMessageRepository } from './repositories/message.repository.impl';
import { DrizzleScheduleBlockViewRepository } from './repositories/schedule-block-view.repository.impl';
import { DrizzlePlanRepository } from './repositories/plan.repository.impl';
import { DrizzleSubscriptionRepository } from './repositories/subscription.repository.impl';
import { DrizzleAgentUsageViewRepository } from './repositories/agent-usage.view-repository.impl';
import { DrizzlePlanUsageViewRepository } from './repositories/plan-usage.view-repository.impl';
import { DrizzleAgentTraceRepository } from './repositories/agent-trace.repository.impl';
import { DrizzleAgentTraceViewRepository } from './repositories/agent-trace-view.repository.impl';
import { DrizzleNotificationContactRepository } from './repositories/notification-contact.repository.impl';
import { DrizzleAppointmentNotificationSubscriptionRepository } from './repositories/appointment-notification-subscription.repository.impl';
import { DrizzleAppointmentNotificationEventRepository } from './repositories/appointment-notification-event.repository.impl';
import { DrizzleAppointmentNotificationDeliveryRepository } from './repositories/appointment-notification-delivery.repository.impl';
import { DrizzleAppointmentReminderRepository } from './repositories/appointment-reminder.repository.impl';
import { DrizzleTransactionAdapter } from './drizzle-transaction.adapter';

@Global()
@Module({
  providers: [
    { provide: TENANT_REPOSITORY, useClass: DrizzleTenantRepository },
    { provide: USER_REPOSITORY, useClass: DrizzleUserRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: DrizzleAuditLogRepository },
    {
      provide: BUSINESS_CONFIG_REPOSITORY,
      useClass: DrizzleBusinessConfigRepository,
    },
    { provide: BRANCH_REPOSITORY, useClass: DrizzleBranchRepository },
    {
      provide: BRANCH_PROFESSIONAL_REPOSITORY,
      useClass: DrizzleBranchProfessionalRepository,
    },
    {
      provide: BRANCH_SERVICE_REPOSITORY,
      useClass: DrizzleBranchServiceRepository,
    },
    {
      provide: BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
      useClass: DrizzleBranchProfessionalServiceWindowRepository,
    },
    {
      provide: USER_BRANCH_REPOSITORY,
      useClass: DrizzleUserBranchRepository,
    },
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: DrizzleProfessionalRepository,
    },
    { provide: SERVICE_REPOSITORY, useClass: DrizzleServiceRepository },
    { provide: DEPOSIT_QR_REPOSITORY, useClass: DrizzleDepositQrRepository },
    { provide: CLIENT_REPOSITORY, useClass: DrizzleClientRepository },
    {
      provide: SCHEDULE_BLOCK_REPOSITORY,
      useClass: DrizzleScheduleBlockRepository,
    },
    {
      provide: SCHEDULE_BLOCK_VIEW_REPOSITORY,
      useClass: DrizzleScheduleBlockViewRepository,
    },
    {
      provide: APPOINTMENT_REPOSITORY,
      useClass: DrizzleAppointmentRepository,
    },
    {
      provide: DEPOSIT_RECEIPT_REPOSITORY,
      useClass: DrizzleDepositReceiptRepository,
    },
    {
      provide: APPOINTMENT_VIEW_REPOSITORY,
      useClass: DrizzleAppointmentViewRepository,
    },
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: DrizzleConversationRepository,
    },
    {
      provide: CONVERSATION_VIEW_REPOSITORY,
      useClass: DrizzleConversationViewRepository,
    },
    { provide: MESSAGE_REPOSITORY, useClass: DrizzleMessageRepository },
    { provide: PLAN_REPOSITORY, useClass: DrizzlePlanRepository },
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: DrizzleSubscriptionRepository,
    },
    {
      provide: AGENT_USAGE_VIEW_REPOSITORY,
      useClass: DrizzleAgentUsageViewRepository,
    },
    {
      provide: PLAN_USAGE_VIEW_REPOSITORY,
      useClass: DrizzlePlanUsageViewRepository,
    },
    {
      provide: AGENT_TRACE_REPOSITORY,
      useClass: DrizzleAgentTraceRepository,
    },
    {
      provide: AGENT_TRACE_VIEW_REPOSITORY,
      useClass: DrizzleAgentTraceViewRepository,
    },
    {
      provide: NOTIFICATION_CONTACT_REPOSITORY,
      useClass: DrizzleNotificationContactRepository,
    },
    {
      provide: APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
      useClass: DrizzleAppointmentNotificationSubscriptionRepository,
    },
    {
      provide: APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
      useClass: DrizzleAppointmentNotificationEventRepository,
    },
    {
      provide: APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
      useClass: DrizzleAppointmentNotificationDeliveryRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_REPOSITORY,
      useClass: DrizzleAppointmentReminderRepository,
    },
    { provide: TRANSACTION_PORT, useClass: DrizzleTransactionAdapter },
  ],
  exports: [
    TENANT_REPOSITORY,
    USER_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    BUSINESS_CONFIG_REPOSITORY,
    BRANCH_REPOSITORY,
    BRANCH_PROFESSIONAL_REPOSITORY,
    BRANCH_SERVICE_REPOSITORY,
    BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY,
    USER_BRANCH_REPOSITORY,
    PROFESSIONAL_REPOSITORY,
    SERVICE_REPOSITORY,
    DEPOSIT_QR_REPOSITORY,
    CLIENT_REPOSITORY,
    SCHEDULE_BLOCK_REPOSITORY,
    SCHEDULE_BLOCK_VIEW_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    DEPOSIT_RECEIPT_REPOSITORY,
    APPOINTMENT_VIEW_REPOSITORY,
    CONVERSATION_REPOSITORY,
    CONVERSATION_VIEW_REPOSITORY,
    MESSAGE_REPOSITORY,
    PLAN_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    AGENT_USAGE_VIEW_REPOSITORY,
    PLAN_USAGE_VIEW_REPOSITORY,
    AGENT_TRACE_REPOSITORY,
    AGENT_TRACE_VIEW_REPOSITORY,
    NOTIFICATION_CONTACT_REPOSITORY,
    APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
    APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
    APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
    APPOINTMENT_REMINDER_REPOSITORY,
    TRANSACTION_PORT,
  ],
})
export class PersistenceModule {}
