import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AgentModule } from '@infrastructure/agent/agent.module';
import { EvolutionWebhookParser } from '@infrastructure/messaging/evolution-webhook.parser';
import { INBOUND_MESSAGES_QUEUE } from './queue.constants';
import { InboundMessagesProcessor } from './processors/inbound-messages.processor';

export { INBOUND_MESSAGES_QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    AgentModule,
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
    BullModule.registerQueue({ name: INBOUND_MESSAGES_QUEUE }),
  ],
  providers: [EvolutionWebhookParser, InboundMessagesProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
