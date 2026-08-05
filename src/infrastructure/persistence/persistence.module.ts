import { Global, Module } from '@nestjs/common';

import { TENANT_REPOSITORY } from '@domain/tenants/repositories/tenant.repository';
import { USER_REPOSITORY } from '@domain/users/repositories/user.repository';
import { AUDIT_LOG_REPOSITORY } from '@domain/audit/repositories/audit-log.repository';
import { BUSINESS_CONFIG_REPOSITORY } from '@domain/business-config/repositories/business-config.repository';
import { PROFESSIONAL_REPOSITORY } from '@domain/professionals/repositories/professional.repository';
import { SERVICE_REPOSITORY } from '@domain/services/repositories/service.repository';
import { CLIENT_REPOSITORY } from '@domain/clients/repositories/client.repository';
import { SCHEDULE_BLOCK_REPOSITORY } from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { APPOINTMENT_REPOSITORY } from '@domain/appointments/repositories/appointment.repository';
import { APPOINTMENT_VIEW_REPOSITORY } from '@domain/appointments/repositories/appointment-view.repository';
import { CONVERSATION_REPOSITORY } from '@domain/conversations/repositories/conversation.repository';
import { CONVERSATION_VIEW_REPOSITORY } from '@domain/conversations/repositories/conversation-view.repository';
import { MESSAGE_REPOSITORY } from '@domain/conversations/repositories/message.repository';
import { SCHEDULE_BLOCK_VIEW_REPOSITORY } from '@domain/schedule-blocks/repositories/schedule-block-view.repository';

import { DrizzleTenantRepository } from './repositories/tenant.repository.impl';
import { DrizzleUserRepository } from './repositories/user.repository.impl';
import { DrizzleAuditLogRepository } from './repositories/audit-log.repository.impl';
import { DrizzleBusinessConfigRepository } from './repositories/business-config.repository.impl';
import { DrizzleProfessionalRepository } from './repositories/professional.repository.impl';
import { DrizzleServiceRepository } from './repositories/service.repository.impl';
import { DrizzleClientRepository } from './repositories/client.repository.impl';
import { DrizzleScheduleBlockRepository } from './repositories/schedule-block.repository.impl';
import { DrizzleAppointmentRepository } from './repositories/appointment.repository.impl';
import { DrizzleAppointmentViewRepository } from './repositories/appointment-view.repository.impl';
import { DrizzleConversationRepository } from './repositories/conversation.repository.impl';
import { DrizzleConversationViewRepository } from './repositories/conversation-view.repository.impl';
import { DrizzleMessageRepository } from './repositories/message.repository.impl';
import { DrizzleScheduleBlockViewRepository } from './repositories/schedule-block-view.repository.impl';

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
    {
      provide: PROFESSIONAL_REPOSITORY,
      useClass: DrizzleProfessionalRepository,
    },
    { provide: SERVICE_REPOSITORY, useClass: DrizzleServiceRepository },
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
  ],
  exports: [
    TENANT_REPOSITORY,
    USER_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    BUSINESS_CONFIG_REPOSITORY,
    PROFESSIONAL_REPOSITORY,
    SERVICE_REPOSITORY,
    CLIENT_REPOSITORY,
    SCHEDULE_BLOCK_REPOSITORY,
    SCHEDULE_BLOCK_VIEW_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    APPOINTMENT_VIEW_REPOSITORY,
    CONVERSATION_REPOSITORY,
    CONVERSATION_VIEW_REPOSITORY,
    MESSAGE_REPOSITORY,
  ],
})
export class PersistenceModule {}
