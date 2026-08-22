import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppointmentNotificationsModule } from '@application/appointment-notifications/appointment-notifications.module';
import { DepositsApplicationModule } from '@application/deposits/deposits-application.module';
import { RemindersModule } from '@application/reminders/reminders.module';
import { AgentModule } from '@infrastructure/agent/agent.module';
import { EnsureHumanAttentionLabelUseCase } from '@application/messaging/use-cases/ensure-human-attention-label.use-case';
import { SyncConversationLabelUseCase } from '@application/conversations/use-cases/sync-conversation-label.use-case';
import { EvolutionWebhookParser } from '@infrastructure/messaging/evolution-webhook.parser';
import {
  APPOINTMENT_NOTIFICATIONS_QUEUE,
  APPOINTMENT_REMINDERS_QUEUE,
  INBOUND_MESSAGES_QUEUE,
} from './queue.constants';
import { AppointmentNotificationsProcessor } from './processors/appointment-notifications.processor';
import { AppointmentRemindersProcessor } from './processors/appointment-reminders.processor';
import { InboundMessagesProcessor } from './processors/inbound-messages.processor';

export { INBOUND_MESSAGES_QUEUE } from './queue.constants';
export { APPOINTMENT_NOTIFICATIONS_QUEUE } from './queue.constants';
export { APPOINTMENT_REMINDERS_QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    AgentModule,
    AppointmentNotificationsModule,
    RemindersModule,
    DepositsApplicationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: INBOUND_MESSAGES_QUEUE },
      { name: APPOINTMENT_NOTIFICATIONS_QUEUE },
      { name: APPOINTMENT_REMINDERS_QUEUE },
    ),
  ],
  providers: [
    EvolutionWebhookParser,
    InboundMessagesProcessor,
    AppointmentNotificationsProcessor,
    AppointmentRemindersProcessor,
    SyncConversationLabelUseCase,
    EnsureHumanAttentionLabelUseCase,
  ],
  exports: [BullModule, EvolutionWebhookParser],
})
export class QueuesModule {}
